// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HonorariosTestBase} from "./Honorarios.Base.t.sol";
import {Honorarios} from "../Honorarios.sol";

// ── Tests: pay() mechanics, arithmetic, guards ───────────────────────────────
contract HonorariosPayTest is HonorariosTestBase {

    // ── 3. Rate snapshot ──────────────────────────────────────────────────

    function test_RateSnapshotUsesIssuanceRate() public {
        // Issue at 1000 bps
        vm.prank(freelancer);
        h.setProfile(1000, 0);
        vm.prank(freelancer);
        h.issue("snap-01", 1e18, "");

        // Change profile to 2000 bps BEFORE payment
        vm.prank(freelancer);
        h.setProfile(2000, 0);

        // Pay — should use 1000 bps (snapshot at issue time)
        _pay(payer, freelancer, "snap-01", 1e18);

        uint256 expectedReserve = (uint256(1e18) * 1000 + 10_000 - 1) / 10_000; // ceil
        assertEq(h.reserves(freelancer), expectedReserve);
    }

    // ── 4. WrongAmount ────────────────────────────────────────────────────

    function test_PayRevertsWrongAmountLess() public {
        _profileAndIssue(freelancer, 0, 0, "wamt-01", 1e18, "");

        vm.deal(payer, 1e18);
        vm.prank(payer);
        vm.expectRevert(Honorarios.WrongAmount.selector);
        h.pay{value: 0.5e18}(freelancer, "wamt-01");
    }

    function test_PayRevertsWrongAmountMore() public {
        _profileAndIssue(freelancer, 0, 0, "wamt-02", 1e18, "");

        vm.deal(payer, 2e18);
        vm.prank(payer);
        vm.expectRevert(Honorarios.WrongAmount.selector);
        h.pay{value: 1.5e18}(freelancer, "wamt-02");
    }

    // ── 5. AlreadyPaid / UnknownReceipt ───────────────────────────────────

    function test_PayRevertsAlreadyPaid() public {
        _profileAndIssue(freelancer, 0, 0, "dup-pay", 1e18, "");
        _pay(payer, freelancer, "dup-pay", 1e18);

        vm.deal(payer, 1e18);
        vm.prank(payer);
        vm.expectRevert(Honorarios.AlreadyPaid.selector);
        h.pay{value: 1e18}(freelancer, "dup-pay");
    }

    function test_PayRevertsUnknownReceipt() public {
        // No receipt at all
        vm.deal(payer, 1e18);
        vm.prank(payer);
        vm.expectRevert(Honorarios.UnknownReceipt.selector);
        h.pay{value: 1e18}(freelancer, "ghost-ref");
    }

    // ── 6. Split arithmetic (18-decimal) ─────────────────────────────────
    // pay() uses push-with-fallback: for EOA freelancers the push succeeds,
    // net is delivered directly and pendingNet stays zero.

    function test_SplitArithmetic1UsdcAt800Bps() public {
        uint256 amount          = 1e18;
        uint256 expectedReserve = 8e16; // ceil(1e18 * 800 / 10000) = 8e16 exact
        uint256 expectedNet     = 9.2e17;

        _profileAndIssue(freelancer, 800, 0, "split-01", amount, "");

        uint256 flBefore = freelancer.balance;
        _pay(payer, freelancer, "split-01", amount);

        // Push succeeded for EOA: freelancer balance increased by net immediately
        assertEq(freelancer.balance - flBefore, expectedNet,     "net not pushed to EOA");
        // pendingNet is 0 — net was NOT deferred
        assertEq(h.pendingNet(freelancer),       0,              "pendingNet should be 0 for EOA push");
        // reserve is correctly credited
        assertEq(h.reserves(freelancer),         expectedReserve, "reserve mismatch");
        // Contract balance equals only the reserve (net was pushed out)
        assertEq(address(h).balance, expectedReserve, "contract balance should equal reserve only");
    }

    function test_ContractBalanceEqualsSumOfReserves() public {
        // Two EOA freelancers; push succeeds for both.
        // After pay(), contract holds only reserves (net was pushed).
        address fl2    = makeAddr("fl2");
        address payer2 = makeAddr("payer2");

        _profileAndIssue(freelancer, 800,  0, "r1", 1e18, "");
        _profileAndIssue(fl2,        1000, 0, "r2", 2e18, "");

        _pay(payer,  freelancer, "r1", 1e18);
        _pay(payer2, fl2,        "r2", 2e18);

        // totalLiabilities == totalReserves + totalPendingNet (pendingNet==0 for EOA)
        assertEq(address(h).balance, h.totalLiabilities(), "contract balance != total liabilities");

        // Decomposed: balance == res1 + res2  (no pendingNet for EOA pushes)
        uint256 res1 = h.reserves(freelancer);
        uint256 res2 = h.reserves(fl2);
        assertEq(address(h).balance, res1 + res2, "balance should equal res1+res2 only");
    }

    // ── Emits Paid event with netSent=true ────────────────────────────────

    function test_PayEmitsPaidEvent() public {
        uint256 amount = 1e18;
        uint16  taxBps = 800;
        _profileAndIssue(freelancer, taxBps, 0, "evt-01", amount, "");

        uint256 reserve = (amount * taxBps + 10_000 - 1) / 10_000;
        uint256 net     = amount - reserve;
        uint256 period  = h.periodOf(block.timestamp, 0);

        bytes32 refHash = keccak256(bytes("evt-01"));

        vm.deal(payer, amount);
        vm.prank(payer);
        vm.expectEmit(true, true, true, true, address(h));
        // netSent=true because freelancer is an EOA and accepts the push
        emit Honorarios.Paid(freelancer, refHash, "evt-01", payer, amount, net, reserve, period, true);
        h.pay{value: amount}(freelancer, "evt-01");
    }
}
