// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Honorarios} from "../Honorarios.sol";

/// @dev Shared base: setUp, actors, helpers. No test functions here.
abstract contract HonorariosTestBase is Test {
    Honorarios internal h;

    address internal freelancer = makeAddr("freelancer");
    address internal payer      = makeAddr("payer");
    address internal stranger   = makeAddr("stranger");

    // Helpers ---------------------------------------------------------------

    /// Set a profile then issue a receipt, returning the refHash.
    function _profileAndIssue(
        address who,
        uint16 taxBps,
        int16 utcOffsetMin,
        string memory ref,
        uint256 amount,
        string memory concept
    ) internal returns (bytes32 refHash) {
        vm.startPrank(who);
        h.setProfile(taxBps, utcOffsetMin);
        h.issue(ref, amount, concept);
        vm.stopPrank();
        refHash = keccak256(bytes(ref));
    }

    /// Pay a receipt from `from` with exactly `amount` wei.
    function _pay(address from, address fl, string memory ref, uint256 amount) internal {
        vm.deal(from, amount);
        vm.prank(from);
        h.pay{value: amount}(fl, ref);
    }

    function setUp() public virtual {
        h = new Honorarios();
    }
}
