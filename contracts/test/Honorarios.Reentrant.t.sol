// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HonorariosTestBase} from "./Honorarios.Base.t.sol";
import {Honorarios} from "../Honorarios.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  Malicious / special freelancer contracts for reentrancy and fallback tests
// ─────────────────────────────────────────────────────────────────────────────

/// @dev During the ETH push from pay(), tries to re-enter pay() from receive().
///      nonReentrant is already locked, so the inner pay() reverts.
///      The low-level call returns ok=false → net is deferred to pendingNet.
contract MaliciousFreelancerReenterPay {
    Honorarios public h;
    address public payer;
    string  public ref;
    uint256 public callCount;

    constructor(Honorarios _h) { h = _h; }

    function setup(address _payer, string memory _ref) external {
        payer = _payer;
        ref   = _ref;
    }

    function setProfile(uint16 taxBps, int16 utcOffsetMin) external {
        h.setProfile(taxBps, utcOffsetMin);
    }

    function issue(string memory _ref, uint256 amount, string memory concept) external {
        h.issue(_ref, amount, concept);
    }

    /// @dev Called during pay()'s push attempt.
    ///      Tries to re-enter pay() — nonReentrant guard causes revert, so
    ///      the outer low-level call returns ok=false → deferred path taken.
    receive() external payable {
        callCount++;
        if (callCount == 1) {
            // This will revert because nonReentrant is locked
            try h.pay{value: msg.value}(address(this), ref) {} catch {}
        }
    }
}

/// @dev Tries to re-enter withdrawReserve() when it receives the withdrawal.
contract MaliciousFreelancerReenterWithdraw {
    Honorarios public h;
    uint256 public callCount;

    constructor(Honorarios _h) { h = _h; }

    function setProfile(uint16 taxBps, int16 utcOffsetMin) external {
        h.setProfile(taxBps, utcOffsetMin);
    }

    function issue(string memory _ref, uint256 amount, string memory concept) external {
        h.issue(_ref, amount, concept);
    }

    function doWithdraw(uint256 amount) external {
        h.withdrawReserve(amount);
    }

    receive() external payable {
        callCount++;
        if (callCount == 1) {
            // Try to withdraw again — nonReentrant should block
            try h.withdrawReserve(msg.value) {} catch {}
        }
    }
}

/// @dev Rejects all ETH transfers (no receive/fallback).
///      With push-with-fallback, pay() catches the failed push and defers net
///      to pendingNet.  claimNet() will then revert with TransferFailed when
///      it tries to push ETH here.
contract RejectEthFreelancer {
    Honorarios public h;

    constructor(Honorarios _h) { h = _h; }

    function setProfile(uint16 taxBps, int16 utcOffsetMin) external {
        h.setProfile(taxBps, utcOffsetMin);
    }

    function issue(string memory _ref, uint256 amount, string memory concept) external {
        h.issue(_ref, amount, concept);
    }

    function doClaim() external {
        h.claimNet();
    }

    // No receive() → the push in pay() returns ok=false → deferred path.
    // claimNet() also fails because there is still no receive().
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────────────────────────────────────
contract HonorariosReentrantTest is HonorariosTestBase {

    // ── 11a. Push-with-fallback for a rejecting freelancer ───────────────────
    //
    //   RejectEthFreelancer has no receive(). pay() attempts the push, the
    //   call returns ok=false, and net is credited to pendingNet (fallback path).
    //   pay() itself must NOT revert.  claimNet() reverts with TransferFailed.

    function test_FailingNetTransferRevertsPayAtomically() public {
        RejectEthFreelancer rejFL = new RejectEthFreelancer(h);

        rejFL.setProfile(800, 0);
        rejFL.issue("rej-01", 1e18, "");

        // pay() must SUCCEED even though the push fails — fallback path.
        vm.deal(payer, 1e18);
        vm.prank(payer);
        h.pay{value: 1e18}(address(rejFL), "rej-01"); // must not revert

        // Receipt IS marked paid
        Honorarios.Receipt memory r = h.receiptOf(address(rejFL), "rej-01");
        assertTrue(r.paid, "receipt should be marked paid");

        // Reserve IS credited
        uint256 expectedReserve = (uint256(1e18) * 800 + 10_000 - 1) / 10_000;
        assertEq(h.reserves(address(rejFL)), expectedReserve, "reserve not credited");

        // pendingNet IS credited because push failed (fallback path)
        uint256 expectedNet = 1e18 - expectedReserve;
        assertEq(h.pendingNet(address(rejFL)), expectedNet, "pendingNet not credited after push failure");

        // NetDeferred event was emitted (checked via state above; event tested separately)

        // claimNet() reverts with TransferFailed because rejFL still has no receive()
        vm.expectRevert(Honorarios.TransferFailed.selector);
        rejFL.doClaim();

        // pendingNet remains (claimNet() reverted, so CEI rollback restores it)
        assertEq(h.pendingNet(address(rejFL)), expectedNet, "pendingNet should remain after failed claim");
    }

    // ── 11a-event: NetDeferred emitted when push fails ────────────────────────

    function test_NetDeferredEventEmittedOnPushFailure() public {
        RejectEthFreelancer rejFL = new RejectEthFreelancer(h);
        rejFL.setProfile(800, 0);
        rejFL.issue("rej-evt", 1e18, "");

        uint256 expectedReserve = (uint256(1e18) * 800 + 10_000 - 1) / 10_000;
        uint256 expectedNet     = 1e18 - expectedReserve;
        bytes32 refHash         = keccak256(bytes("rej-evt"));

        vm.deal(payer, 1e18);
        vm.prank(payer);
        vm.expectEmit(true, true, false, true, address(h));
        emit Honorarios.NetDeferred(address(rejFL), refHash, expectedNet);
        h.pay{value: 1e18}(address(rejFL), "rej-evt");
    }

    // ── 11a-event: Paid emitted with netSent=false on push failure ────────────

    function test_PaidEventNetSentFalseOnPushFailure() public {
        RejectEthFreelancer rejFL = new RejectEthFreelancer(h);
        rejFL.setProfile(800, 0);
        rejFL.issue("rej-paid", 1e18, "");

        uint256 expectedReserve = (uint256(1e18) * 800 + 10_000 - 1) / 10_000;
        uint256 expectedNet     = 1e18 - expectedReserve;
        uint256 period          = h.periodOf(block.timestamp, 0);
        bytes32 refHash         = keccak256(bytes("rej-paid"));

        vm.deal(payer, 1e18);
        vm.prank(payer);
        vm.expectEmit(true, true, true, true, address(h));
        emit Honorarios.Paid(
            address(rejFL), refHash, "rej-paid", payer,
            1e18, expectedNet, expectedReserve, period,
            false // netSent=false: push failed, deferred
        );
        h.pay{value: 1e18}(address(rejFL), "rej-paid");
    }

    // ── 11b. Reentrancy in pay(): re-enter from receive() ────────────────────
    //
    //   MaliciousFreelancerReenterPay.receive() tries to call pay() again while
    //   the nonReentrant lock is held.  The inner pay() reverts (caught by try/catch),
    //   but receive() itself returns normally → the outer low-level push returns ok=true.
    //   Net is delivered directly to malFL.  Reserve must be credited exactly once (not doubled).
    //   The re-entrant second receipt pay attempt should also fail (receipt is already AlreadyPaid
    //   or the ref is different so UnknownReceipt — either way the inner call is silently caught).

    function test_ReentrancyPayCannotDoubleCreditReserve() public {
        MaliciousFreelancerReenterPay malFL = new MaliciousFreelancerReenterPay(h);

        malFL.setProfile(1000, 0);
        malFL.issue("re-pay-01", 1e18, "");

        address rePayer = makeAddr("re-payer");
        vm.deal(rePayer, 2e18);

        malFL.setup(rePayer, "re-pay-01");

        vm.prank(rePayer);
        // pay() must succeed; the inner re-entrant call is blocked by nonReentrant,
        // but receive() catches the revert and returns normally — so push is ok=true.
        h.pay{value: 1e18}(address(malFL), "re-pay-01");

        // Reserve credited exactly once — not doubled
        uint256 expectedReserve = (uint256(1e18) * 1000 + 10_000 - 1) / 10_000;
        assertEq(h.reserves(address(malFL)), expectedReserve, "reserve doubled by reentrancy");

        // Push succeeded (receive() didn't propagate the revert) → net in malFL.balance
        uint256 expectedNet = 1e18 - expectedReserve;
        assertEq(address(malFL).balance, expectedNet, "net should be in malFL.balance after successful push");

        // pendingNet stays zero — push was not deferred
        assertEq(h.pendingNet(address(malFL)), 0, "pendingNet should be 0 after successful push");

        // totalPendingNet is also zero
        assertEq(h.totalPendingNet(), 0, "totalPendingNet should be 0");
    }

    // ── 11c. Reentrancy in withdrawReserve() ─────────────────────────────────

    function test_ReentrancyWithdrawCannotDoubleWithdraw() public {
        MaliciousFreelancerReenterWithdraw malFL = new MaliciousFreelancerReenterWithdraw(h);

        malFL.setProfile(1000, 0);
        malFL.issue("re-wd-01", 1e18, "");

        // pay() to a contract with receive(): push may succeed or fail.
        // Either way the reserve is credited — what matters for this test.
        _pay(payer, address(malFL), "re-wd-01", 1e18);

        uint256 reserve = h.reserves(address(malFL));
        assertGt(reserve, 0);

        uint256 contractBalBefore = address(h).balance;

        // Attempt double-withdraw via reentrancy in withdrawReserve()
        malFL.doWithdraw(reserve);

        // Reserve should be zero — not negative and not double-drained
        assertEq(h.reserves(address(malFL)), 0, "reserve not zeroed");
        // Contract balance decreased by exactly reserve
        assertEq(address(h).balance, contractBalBefore - reserve, "contract over-drained");
    }
}
