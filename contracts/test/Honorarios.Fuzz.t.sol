// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HonorariosTestBase} from "./Honorarios.Base.t.sol";
import {Honorarios} from "../Honorarios.sol";

// ── Tests: fuzz (rounding), withdraw access control, period/month ─────────────
contract HonorariosRoundingAndWithdrawTest is HonorariosTestBase {

    // ── 7. Rounding fuzz ─────────────────────────────────────────────────────

    /// net + reserve == amount, reserve == ceil(amount * taxBps / 10000)
    /// pay() uses push-with-fallback: for an EOA freelancer the push succeeds,
    /// so net lands in the freelancer's balance, NOT in pendingNet.
    function testFuzz_SplitRounding(uint256 amount, uint16 taxBps) public {
        // Bound amount to prevent overflow in (amount * taxBps) — max taxBps = 5000,
        // so amount * 5000 must fit in uint256: amount <= type(uint256).max / 5000
        amount = bound(amount, 1, type(uint256).max / 5000);
        taxBps = uint16(bound(uint256(taxBps), 0, 5000));

        // Issue under a fresh fuzz freelancer to avoid ref collisions
        address fl = makeAddr("fuzz-fl");

        vm.prank(fl);
        h.setProfile(taxBps, 0);

        vm.prank(fl);
        h.issue("fuzz-ref", amount, "");

        uint256 flBefore = fl.balance;
        _pay(payer, fl, "fuzz-ref", amount);

        uint256 reserve = h.reserves(fl);
        // EOA push succeeds: net went to fl.balance, pendingNet stays 0
        uint256 net = fl.balance - flBefore;

        // net + reserve == amount
        assertEq(net + reserve, amount, "net+reserve != amount");

        // reserve == ceil(amount * taxBps / 10000)
        uint256 expectedReserve = taxBps == 0 ? 0 : (amount * uint256(taxBps) + 10_000 - 1) / 10_000;
        assertEq(reserve, expectedReserve, "reserve != ceil");

        // pendingNet must be zero for EOA (push succeeded)
        assertEq(h.pendingNet(fl), 0, "pendingNet should be 0 for EOA freelancer");
    }

    // ── 8. Withdraw access control ────────────────────────────────────────────

    function test_StrangerCannotWithdrawReserve() public {
        // Set up a reserve for freelancer
        _profileAndIssue(freelancer, 1000, 0, "wd-01", 1e18, "");
        _pay(payer, freelancer, "wd-01", 1e18);

        uint256 reserve = h.reserves(freelancer);
        assertGt(reserve, 0);

        // stranger tries to withdraw freelancer's reserve; they get
        // InsufficientReserve because stranger.reserve == 0
        vm.prank(stranger);
        vm.expectRevert(Honorarios.InsufficientReserve.selector);
        h.withdrawReserve(reserve);
    }

    function test_WithdrawMoreThanReserveReverts() public {
        _profileAndIssue(freelancer, 1000, 0, "wd-02", 1e18, "");
        _pay(payer, freelancer, "wd-02", 1e18);

        uint256 reserve = h.reserves(freelancer);

        vm.prank(freelancer);
        vm.expectRevert(Honorarios.InsufficientReserve.selector);
        h.withdrawReserve(reserve + 1);
    }

    function test_PartialWithdrawLeavesRemainder() public {
        _profileAndIssue(freelancer, 1000, 0, "wd-03", 1e18, "");
        _pay(payer, freelancer, "wd-03", 1e18);

        uint256 reserve = h.reserves(freelancer);
        uint256 half    = reserve / 2;

        // EOA push succeeded — no pendingNet; contract holds only the reserve
        assertEq(h.pendingNet(freelancer), 0, "pendingNet should be 0 after EOA push");

        vm.prank(freelancer);
        h.withdrawReserve(half);

        assertEq(h.reserves(freelancer), reserve - half, "reserve remainder wrong");
        // Contract holds only the remaining reserve (pendingNet == 0)
        assertEq(address(h).balance, reserve - half, "contract balance wrong after partial withdraw");
    }

    function test_FullWithdrawEmptiesReserve() public {
        _profileAndIssue(freelancer, 1000, 0, "wd-04", 1e18, "");
        _pay(payer, freelancer, "wd-04", 1e18);

        uint256 reserve = h.reserves(freelancer);
        assertGt(reserve, 0);

        // EOA push succeeded — no pendingNet
        assertEq(h.pendingNet(freelancer), 0, "pendingNet should be 0 after EOA push");

        uint256 flBefore = freelancer.balance;
        vm.prank(freelancer);
        h.withdrawReserve(reserve);

        assertEq(h.reserves(freelancer), 0,       "reserve not zeroed");
        // Contract is empty: net was pushed out during pay(), reserve now withdrawn
        assertEq(address(h).balance, 0,            "contract should be empty after full withdraw");
        assertEq(freelancer.balance - flBefore, reserve, "freelancer did not receive reserve");
    }

    function test_WithdrawZeroReverts() public {
        vm.prank(freelancer);
        vm.expectRevert(Honorarios.InvalidAmount.selector);
        h.withdrawReserve(0);
    }
}
