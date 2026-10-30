// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HonorariosTestBase} from "./Honorarios.Base.t.sol";
import {Honorarios} from "../Honorarios.sol";

// ── Tests: setProfile validation + issue() guards ────────────────────────────
contract HonorariosProfileTest is HonorariosTestBase {

    // ── 1. Profile validation ──────────────────────────────────────────────

    function test_RejectsTaxBpsTooHigh() public {
        vm.prank(freelancer);
        vm.expectRevert(Honorarios.TaxRateTooHigh.selector);
        h.setProfile(5001, 0);
    }

    function test_AcceptsTaxBps5000() public {
        vm.prank(freelancer);
        h.setProfile(5000, 0);
        (uint16 bps,, bool isSet) = h.profileOf(freelancer);
        assertEq(bps, 5000);
        assertTrue(isSet);
    }

    function test_AcceptsTaxBps0() public {
        vm.prank(freelancer);
        h.setProfile(0, 0);
        (uint16 bps,, bool isSet) = h.profileOf(freelancer);
        assertEq(bps, 0);
        assertTrue(isSet);
    }

    function test_RejectsUtcOffsetMinTooLow() public {
        vm.prank(freelancer);
        vm.expectRevert(Honorarios.InvalidUtcOffset.selector);
        h.setProfile(0, -721);
    }

    function test_RejectsUtcOffsetMinTooHigh() public {
        vm.prank(freelancer);
        vm.expectRevert(Honorarios.InvalidUtcOffset.selector);
        h.setProfile(0, 841);
    }

    function test_AcceptsUtcOffsetMinMinus720() public {
        vm.prank(freelancer);
        h.setProfile(0, -720);
        (, int16 offset, bool isSet) = h.profileOf(freelancer);
        assertEq(offset, -720);
        assertTrue(isSet);
    }

    function test_AcceptsUtcOffsetMin840() public {
        vm.prank(freelancer);
        h.setProfile(0, 840);
        (, int16 offset, bool isSet) = h.profileOf(freelancer);
        assertEq(offset, 840);
        assertTrue(isSet);
    }

    // ── 2. issue() guards ─────────────────────────────────────────────────

    function test_IssueRevertsNoProfile() public {
        vm.prank(stranger);
        vm.expectRevert(Honorarios.NoProfile.selector);
        h.issue("ref-001", 1e18, "");
    }

    function test_IssueIsUnderMsgSender() public {
        // freelancer sets profile and issues under their own address
        vm.prank(freelancer);
        h.setProfile(500, 0);

        vm.prank(freelancer);
        h.issue("ref-001", 1e18, "");

        // receipt is stored under freelancer, NOT stranger
        Honorarios.Receipt memory r = h.receiptOf(freelancer, "ref-001");
        assertEq(r.amount, 1e18);

        // stranger has no receipt for that ref
        Honorarios.Receipt memory rStranger = h.receiptOf(stranger, "ref-001");
        assertEq(rStranger.issuedAt, 0); // not set
    }

    function test_IssueRevertsEmptyRef() public {
        vm.prank(freelancer);
        h.setProfile(0, 0);

        vm.prank(freelancer);
        vm.expectRevert(Honorarios.EmptyRef.selector);
        h.issue("", 1e18, "");
    }

    function test_IssueRevertsRefTooLong() public {
        vm.prank(freelancer);
        h.setProfile(0, 0);

        // 33-byte ref
        string memory longRef = "123456789012345678901234567890123"; // 33 chars
        assertEq(bytes(longRef).length, 33);

        vm.prank(freelancer);
        vm.expectRevert(Honorarios.RefTooLong.selector);
        h.issue(longRef, 1e18, "");
    }

    function test_IssueRevertsConceptTooLong() public {
        vm.prank(freelancer);
        h.setProfile(0, 0);

        // 81-byte concept
        string memory longConcept = "123456789012345678901234567890123456789012345678901234567890123456789012345678901"; // 81 chars
        assertEq(bytes(longConcept).length, 81);

        vm.prank(freelancer);
        vm.expectRevert(Honorarios.ConceptTooLong.selector);
        h.issue("ref-001", 1e18, longConcept);
    }

    function test_IssueRevertsInvalidAmount() public {
        vm.prank(freelancer);
        h.setProfile(0, 0);

        vm.prank(freelancer);
        vm.expectRevert(Honorarios.InvalidAmount.selector);
        h.issue("ref-001", 0, "");
    }

    function test_IssueRevertsReceiptExists() public {
        vm.prank(freelancer);
        h.setProfile(500, 0);

        vm.prank(freelancer);
        h.issue("ref-dup", 1e18, "");

        vm.prank(freelancer);
        vm.expectRevert(Honorarios.ReceiptExists.selector);
        h.issue("ref-dup", 2e18, "other");
    }

    function test_IssueRevertsReceiptExistsAfterPaid() public {
        vm.prank(freelancer);
        h.setProfile(500, 0);

        vm.prank(freelancer);
        h.issue("ref-paid", 1e18, "");

        _pay(payer, freelancer, "ref-paid", 1e18);

        // still can't re-issue
        vm.prank(freelancer);
        vm.expectRevert(Honorarios.ReceiptExists.selector);
        h.issue("ref-paid", 1e18, "");
    }

    function test_DuplicateRefUsesKeccak256() public {
        // Two refs that differ by one char are NOT duplicates
        vm.prank(freelancer);
        h.setProfile(0, 0);

        vm.prank(freelancer);
        h.issue("ref-A", 1e18, "");

        // "ref-B" has a different keccak256 — should succeed
        vm.prank(freelancer);
        h.issue("ref-B", 2e18, "");

        assertEq(h.receiptOf(freelancer, "ref-A").amount, 1e18);
        assertEq(h.receiptOf(freelancer, "ref-B").amount, 2e18);

        // "ref-A" again must revert
        vm.prank(freelancer);
        vm.expectRevert(Honorarios.ReceiptExists.selector);
        h.issue("ref-A", 1e18, "");
    }
}
