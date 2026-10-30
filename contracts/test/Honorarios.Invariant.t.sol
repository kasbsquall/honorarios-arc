// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Honorarios} from "../Honorarios.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  Handler
// ─────────────────────────────────────────────────────────────────────────────

contract HonorariosHandler is Test {
    Honorarios public h;

    // Fixed actors
    address[] public actors;
    // Track which actors have a profile
    mapping(address => bool) public hasProfile;
    // Per-actor ref counters to generate unique refs
    mapping(address => uint256) public refCounts;
    // All (actor, ref) pairs for paying
    address[] public issuers;
    string[]  public issuerRefs;

    constructor(Honorarios _h) {
        h = _h;
        actors.push(makeAddr("inv-a"));
        actors.push(makeAddr("inv-b"));
        actors.push(makeAddr("inv-c"));
    }

    // ── setProfile ────────────────────────────────────────────────────────────
    function setProfile(uint256 actorSeed, uint16 taxBps, int16 utcOffsetMin) external {
        address actor = actors[actorSeed % actors.length];
        taxBps       = uint16(bound(uint256(taxBps), 0, 5000));
        // bound int16 to [-720, 840]
        int256 off   = bound(int256(utcOffsetMin), -720, 840);
        utcOffsetMin = int16(off);

        vm.prank(actor);
        h.setProfile(taxBps, utcOffsetMin);
        hasProfile[actor] = true;
    }

    // ── issue ─────────────────────────────────────────────────────────────────
    function issue(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        if (!hasProfile[actor]) return;

        amount = bound(amount, 1, 1e24);

        uint256 idx = refCounts[actor]++;
        string memory ref = string(abi.encodePacked("ref-", _toStr(uint256(uint160(actor))), "-", _toStr(idx)));
        // Truncate to 32 bytes max — just use index-based short ref
        ref = string(abi.encodePacked("r", _toStr(idx % 1_000_000)));

        // Check if ref already issued via receiptOf
        Honorarios.Receipt memory existing = h.receiptOf(actor, ref);
        if (existing.issuedAt != 0) return; // already exists, skip

        vm.prank(actor);
        try h.issue(ref, amount, "") {
            issuers.push(actor);
            issuerRefs.push(ref);
        } catch {}
    }

    // ── pay ───────────────────────────────────────────────────────────────────
    function pay(uint256 idx) external {
        if (issuers.length == 0) return;
        idx = idx % issuers.length;

        address actor = issuers[idx];
        string memory ref = issuerRefs[idx];

        Honorarios.Receipt memory r = h.receiptOf(actor, ref);
        if (r.paid || r.issuedAt == 0) return;

        address payer = makeAddr("handler-payer");
        vm.deal(payer, r.amount);
        vm.prank(payer);
        try h.pay{value: r.amount}(actor, ref) {} catch {}
    }

    // ── withdrawReserve ───────────────────────────────────────────────────────
    function withdrawReserve(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 avail = h.reserves(actor);
        if (avail == 0) return;
        amount = bound(amount, 1, avail);

        vm.prank(actor);
        try h.withdrawReserve(amount) {} catch {}
    }

    // ── claimNet ──────────────────────────────────────────────────────────────
    function claimNet(uint256 actorSeed) external {
        address actor = actors[actorSeed % actors.length];
        if (h.pendingNet(actor) == 0) return;

        vm.prank(actor);
        try h.claimNet() {} catch {}
    }

    // ── helpers ───────────────────────────────────────────────────────────────
    function _toStr(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 tmp = v;
        uint256 len;
        while (tmp != 0) { tmp /= 10; len++; }
        bytes memory bstr = new bytes(len);
        while (v != 0) { bstr[--len] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(bstr);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Invariant contract
// ─────────────────────────────────────────────────────────────────────────────

contract HonorariosInvariantTest is Test {
    Honorarios        public h;
    HonorariosHandler public handler;

    function setUp() public {
        h       = new Honorarios();
        handler = new HonorariosHandler(h);
        targetContract(address(handler));
    }

    /// @dev contract ETH balance == totalLiabilities() == totalReserves + totalPendingNet
    ///
    /// Holds under push-with-fallback:
    ///  - EOA actors: push succeeds → net leaves the contract and is never added
    ///    to totalPendingNet, so both sides of the equation decrease by net together.
    ///  - Contract actors (if any): push fails → net stays in the contract and IS
    ///    added to totalPendingNet, keeping the equation balanced.
    ///  - withdrawReserve / claimNet: both sides decrease by the withdrawn amount.
    function invariant_ContractBalanceEqualsSumOfReserves() public view {
        assertEq(address(h).balance, h.totalLiabilities(), "invariant: balance != totalLiabilities");
    }
}
