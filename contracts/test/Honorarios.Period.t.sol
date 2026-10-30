// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HonorariosTestBase} from "./Honorarios.Base.t.sol";
import {Honorarios} from "../Honorarios.sol";

// ── Tests: periodOf, tax month, enumeration ───────────────────────────────────
contract HonorariasPeriodTest is HonorariosTestBase {

    // ── 9. Tax month / periodOf ──────────────────────────────────────────────

    // UTC offset for Peru: -300 min (-5 h)
    // 2026-11-01 04:59:59 UTC → local 2026-10-31 23:59:59 → October 2026
    // period = 2026 * 12 + (10 - 1) = 24321
    function test_PeriodOf_Peru_BeforeMidnight() public view {
        // 2026-11-01 05:00:00 UTC = 1793509200; minus 1s = 1793509199
        uint256 ts = 1_793_509_199;
        uint256 period = h.periodOf(ts, -300);
        uint256 expected = 2026 * 12 + (10 - 1); // 24321
        assertEq(period, expected, "Peru before midnight should be October 2026");
    }

    // 2026-11-01 05:00:00 UTC → local 2026-11-01 00:00:00 → November 2026
    // period = 2026 * 12 + (11 - 1) = 24322
    function test_PeriodOf_Peru_AtMidnight() public view {
        // 2026-11-01 05:00:00 UTC = 1793509200
        uint256 ts = 1_793_509_200;
        uint256 period = h.periodOf(ts, -300);
        uint256 expected = 2026 * 12 + (11 - 1); // 24322
        assertEq(period, expected, "Peru at midnight should be November 2026");
    }

    // Two freelancers, different offsets: +540 (JST) and -300 (Peru)
    // At a given UTC moment, one may be in a different month than the other.
    function test_TwoFreelancersDifferentOffsets() public view {
        // 2026-11-01 00:30:00 UTC = 1793493000
        // JST (+9h = +540 min): 2026-11-01 09:30:00 → November 2026 → 24322
        // Peru (-5h = -300 min): 2026-10-31 19:30:00 → October 2026 → 24321
        uint256 ts = 1_793_493_000;
        uint256 periodJST  = h.periodOf(ts, 540);
        uint256 periodPeru = h.periodOf(ts, -300);
        assertEq(periodJST,  2026 * 12 + (11 - 1), "JST should be November");
        assertEq(periodPeru, 2026 * 12 + (10 - 1), "Peru should be October");
    }

    // periodOf(2024-02-29 12:00:00 UTC, 0) → year=2024, month=2 → 2024*12+1=24289
    function test_PeriodOf_LeapDay_2024() public view {
        // 2024-02-29 12:00:00 UTC = 1709208000
        uint256 ts = 1_709_208_000;
        uint256 period = h.periodOf(ts, 0);
        assertEq(period, 2024 * 12 + (2 - 1), "Leap day 2024-02-29 should be period 24289");
    }

    // periodOf(2000-03-01 00:00:00 UTC, 0) → year=2000, month=3 → 2000*12+2=24002
    function test_PeriodOf_Y2K_March() public view {
        // 2000-03-01 00:00:00 UTC = 951868800
        uint256 ts = 951_868_800;
        uint256 period = h.periodOf(ts, 0);
        assertEq(period, 2000 * 12 + (3 - 1), "2000-03-01 should be period 24002");
    }

    // monthlyGross accumulates correctly across period boundaries
    function test_MonthlyGrossAccumulates() public {
        // timestamps: one in October, one in November (UTC)
        // 2026-10-15 12:00:00 UTC = 1792065600
        // 2026-11-15 12:00:00 UTC = 1794744000
        uint256 tsOct = 1_792_065_600;
        uint256 tsNov = 1_794_744_000;

        uint256 periodOct = h.periodOf(tsOct, 0);
        uint256 periodNov = h.periodOf(tsNov, 0);
        assertTrue(periodOct != periodNov, "months should differ");

        vm.prank(freelancer);
        h.setProfile(0, 0);

        vm.prank(freelancer);
        h.issue("oct-ref", 1e18, "");

        vm.prank(freelancer);
        h.issue("nov-ref", 2e18, "");

        // Pay the October receipt at an October timestamp
        vm.warp(tsOct);
        _pay(payer, freelancer, "oct-ref", 1e18);

        // Pay the November receipt at a November timestamp
        vm.warp(tsNov);
        _pay(payer, freelancer, "nov-ref", 2e18);

        assertEq(h.monthGross(freelancer, periodOct), 1e18, "Oct gross");
        assertEq(h.monthGross(freelancer, periodNov), 2e18, "Nov gross");
    }

    // ── 10. Enumeration ──────────────────────────────────────────────────────

    function test_ReceiptCountAndRefAtInOrder() public {
        vm.prank(freelancer);
        h.setProfile(0, 0);

        string[3] memory refs = ["alpha", "beta", "gamma"];
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(freelancer);
            h.issue(refs[i], (i + 1) * 1e18, "");
        }

        assertEq(h.receiptCount(freelancer), 3);
        for (uint256 i = 0; i < 3; i++) {
            assertEq(
                keccak256(bytes(h.receiptRefAt(freelancer, i))),
                keccak256(bytes(refs[i])),
                "ref order mismatch"
            );
        }
    }
}
