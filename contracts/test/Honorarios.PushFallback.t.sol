// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HonorariosTestBase} from "./Honorarios.Base.t.sol";
import {Honorarios} from "../Honorarios.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  Helper contracts for push-with-fallback edge cases
// ─────────────────────────────────────────────────────────────────────────────

/// @dev Burns all gas forwarded to it via an infinite assembly loop.
///      The call exhausts NET_PUSH_GAS (100_000) and returns ok=false.
///      The outer transaction must NOT run out of gas.
contract GasBurningFreelancer {
    Honorarios public h;

    constructor(Honorarios _h) { h = _h; }

    function setProfile(uint16 taxBps, int16 utcOffsetMin) external {
        h.setProfile(taxBps, utcOffsetMin);
    }

    function issue(string memory ref, uint256 amount, string memory concept) external {
        h.issue(ref, amount, concept);
    }

    /// @dev Spins forever, burning the 100_000-gas stipend.
    ///      The EVM sees an out-of-gas revert; ok=false in the caller.
    receive() external payable {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Infinite loop — exhausts the gas forwarded with NET_PUSH_GAS
            // and causes an out-of-gas revert within this call frame only.
            let i := 0
            for { } 1 { } {
                i := add(i, 1)
            }
        }
    }
}

/// @dev Rejects the first ETH push, accepts all subsequent ones.
///      First payment → push fails → net deferred to pendingNet.
///      After toggling acceptEth, claimNet() delivers successfully.
contract RetryFreelancer {
    Honorarios public h;
    bool public acceptEth;

    constructor(Honorarios _h) { h = _h; }

    function setProfile(uint16 taxBps, int16 utcOffsetMin) external {
        h.setProfile(taxBps, utcOffsetMin);
    }

    function issue(string memory ref, uint256 amount, string memory concept) external {
        h.issue(ref, amount, concept);
    }

    function startAccepting() external {
        acceptEth = true;
    }

    function doClaim() external {
        h.claimNet();
    }

    receive() external payable {
        require(acceptEth, "not accepting ETH yet");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────────────────────────────────────
contract HonorariosGasBurnTest is HonorariosTestBase {

    // ── Gas-burning freelancer ────────────────────────────────────────────────
    //
    //  receive() burns all of NET_PUSH_GAS (100_000). The push returns ok=false.
    //  pay() must succeed, net must go to pendingNet, and the outer tx must not
    //  run out of gas.

    function test_GasBurningFreelancerDefersNet() public {
        GasBurningFreelancer gasFL = new GasBurningFreelancer(h);

        gasFL.setProfile(800, 0);
        gasFL.issue("gas-01", 1e18, "");

        uint256 expectedReserve = (uint256(1e18) * 800 + 10_000 - 1) / 10_000;
        uint256 expectedNet     = 1e18 - expectedReserve;

        // Pay — outer tx should complete even though NET_PUSH_GAS is exhausted
        vm.deal(payer, 1e18);
        vm.prank(payer);
        h.pay{value: 1e18}(address(gasFL), "gas-01"); // must NOT run out of gas

        // Receipt marked paid
        Honorarios.Receipt memory r = h.receiptOf(address(gasFL), "gas-01");
        assertTrue(r.paid, "receipt not marked paid");

        // Reserve credited
        assertEq(h.reserves(address(gasFL)), expectedReserve, "reserve not credited");

        // Net deferred because push ran out of gas (ok=false)
        assertEq(h.pendingNet(address(gasFL)), expectedNet, "net not deferred for gas-burning FL");

        // totalPendingNet tracks it
        assertEq(h.totalPendingNet(), expectedNet, "totalPendingNet wrong");

        // Invariant: contract balance == totalLiabilities
        assertEq(address(h).balance, h.totalLiabilities(), "balance != liabilities after gas-burn");
    }

    function test_GasBurningFreelancerEmitsNetDeferred() public {
        GasBurningFreelancer gasFL = new GasBurningFreelancer(h);
        gasFL.setProfile(800, 0);
        gasFL.issue("gas-evt", 1e18, "");

        uint256 expectedReserve = (uint256(1e18) * 800 + 10_000 - 1) / 10_000;
        uint256 expectedNet     = 1e18 - expectedReserve;
        bytes32 refHash         = keccak256(bytes("gas-evt"));

        vm.deal(payer, 1e18);
        vm.prank(payer);
        vm.expectEmit(true, true, false, true, address(h));
        emit Honorarios.NetDeferred(address(gasFL), refHash, expectedNet);
        h.pay{value: 1e18}(address(gasFL), "gas-evt");
    }

    function test_GasBurningFreelancerPaidEventNetSentFalse() public {
        GasBurningFreelancer gasFL = new GasBurningFreelancer(h);
        gasFL.setProfile(800, 0);
        gasFL.issue("gas-paid", 1e18, "");

        uint256 expectedReserve = (uint256(1e18) * 800 + 10_000 - 1) / 10_000;
        uint256 expectedNet     = 1e18 - expectedReserve;
        uint256 period          = h.periodOf(block.timestamp, 0);
        bytes32 refHash         = keccak256(bytes("gas-paid"));

        vm.deal(payer, 1e18);
        vm.prank(payer);
        vm.expectEmit(true, true, true, true, address(h));
        emit Honorarios.Paid(
            address(gasFL), refHash, "gas-paid", payer,
            1e18, expectedNet, expectedReserve, period,
            false // netSent=false: push ran out of gas
        );
        h.pay{value: 1e18}(address(gasFL), "gas-paid");
    }
}

contract HonorariosRetryFreelancerTest is HonorariosTestBase {

    // ── Freelancer that accepts on second attempt (claimNet pull path) ─────────
    //
    //  First payment: push rejected → net deferred to pendingNet (NetDeferred).
    //  After toggling acceptEth, claimNet() pushes successfully (NetClaimed).

    function test_RetryFreelancerFirstPaymentDeferred() public {
        RetryFreelancer retryFL = new RetryFreelancer(h);

        retryFL.setProfile(800, 0);
        retryFL.issue("retry-01", 1e18, "");

        uint256 expectedReserve = (uint256(1e18) * 800 + 10_000 - 1) / 10_000;
        uint256 expectedNet     = 1e18 - expectedReserve;
        bytes32 refHash         = keccak256(bytes("retry-01"));

        // First payment: RetryFreelancer.acceptEth == false → push fails
        vm.deal(payer, 1e18);
        vm.prank(payer);
        vm.expectEmit(true, true, false, true, address(h));
        emit Honorarios.NetDeferred(address(retryFL), refHash, expectedNet);
        h.pay{value: 1e18}(address(retryFL), "retry-01");

        // Net deferred
        assertEq(h.pendingNet(address(retryFL)), expectedNet, "net not deferred on first payment");

        // Toggle: RetryFreelancer now accepts ETH
        retryFL.startAccepting();

        // claimNet() should now succeed
        uint256 balBefore = address(retryFL).balance;
        vm.expectEmit(true, false, false, true, address(h));
        emit Honorarios.NetClaimed(address(retryFL), expectedNet);
        retryFL.doClaim();

        assertEq(address(retryFL).balance - balBefore, expectedNet, "net not delivered via claimNet");
        assertEq(h.pendingNet(address(retryFL)), 0, "pendingNet not cleared after claimNet");

        // Contract no longer holds the net
        assertEq(address(h).balance, h.totalLiabilities(), "invariant broken after claimNet");
    }

    function test_RetryFreelancerPaidEventNetSentFalse() public {
        RetryFreelancer retryFL = new RetryFreelancer(h);
        retryFL.setProfile(800, 0);
        retryFL.issue("retry-evt", 1e18, "");

        uint256 expectedReserve = (uint256(1e18) * 800 + 10_000 - 1) / 10_000;
        uint256 expectedNet     = 1e18 - expectedReserve;
        uint256 period          = h.periodOf(block.timestamp, 0);
        bytes32 refHash         = keccak256(bytes("retry-evt"));

        vm.deal(payer, 1e18);
        vm.prank(payer);
        vm.expectEmit(true, true, true, true, address(h));
        emit Honorarios.Paid(
            address(retryFL), refHash, "retry-evt", payer,
            1e18, expectedNet, expectedReserve, period,
            false // netSent=false: first push rejected
        );
        h.pay{value: 1e18}(address(retryFL), "retry-evt");
    }
}
