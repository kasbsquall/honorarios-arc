// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Honorarios is ReentrancyGuard {
    uint16 public constant MAX_TAX_BPS = 5000;
    uint256 public constant BPS = 10_000;
    int16 public constant MIN_OFFSET = -720;
    int16 public constant MAX_OFFSET = 840;
    uint256 public constant MAX_REF_LEN = 32;
    uint256 public constant MAX_CONCEPT_LEN = 80;
    uint256 public constant NET_PUSH_GAS = 100_000;

    error TaxRateTooHigh();
    error InvalidUtcOffset();
    error NoProfile();
    error EmptyRef();
    error RefTooLong();
    error ConceptTooLong();
    error InvalidAmount();
    error ReceiptExists();
    error UnknownReceipt();
    error AlreadyPaid();
    error WrongAmount();
    error TransferFailed();
    error InsufficientReserve();

    struct Profile {
        uint16 taxBps;
        int16 utcOffsetMin;
        bool isSet;
    }

    struct Receipt {
        uint256 amount;
        uint16 taxBps;
        int16 utcOffsetMin;
        uint40 issuedAt;
        bool paid;
        address payer;
        uint40 paidAt;
        string concept;
    }

    mapping(address => Profile) public profiles;
    mapping(address => mapping(bytes32 => Receipt)) public receipts;
    mapping(address => string[]) private _freelancerRefs;
    mapping(address => uint256) public reserves;
    mapping(address => uint256) public pendingNet;
    mapping(address => mapping(uint256 => uint256)) public monthlyGross;
    uint256 public totalReserves;
    uint256 public totalPendingNet;

    event ProfileSet(address indexed freelancer, uint16 taxBps, int16 utcOffsetMin);
    event Issued(
        address indexed freelancer,
        bytes32 indexed refHash,
        string ref,
        uint256 amount,
        uint16 taxBps,
        int16 utcOffsetMin
    );
    event Paid(
        address indexed freelancer,
        bytes32 indexed refHash,
        string ref,
        address indexed payer,
        uint256 amount,
        uint256 net,
        uint256 reserve,
        uint256 period,
        bool netSent
    );
    event NetDeferred(address indexed freelancer, bytes32 indexed refHash, uint256 net);
    event ReserveWithdrawn(address indexed freelancer, uint256 amount);
    event NetClaimed(address indexed freelancer, uint256 amount);

    function setProfile(uint16 taxBps, int16 utcOffsetMin) external {
        if (taxBps > MAX_TAX_BPS) revert TaxRateTooHigh();
        if (utcOffsetMin < MIN_OFFSET || utcOffsetMin > MAX_OFFSET) revert InvalidUtcOffset();

        profiles[msg.sender] = Profile({taxBps: taxBps, utcOffsetMin: utcOffsetMin, isSet: true});

        emit ProfileSet(msg.sender, taxBps, utcOffsetMin);
    }

    function issue(string calldata ref, uint256 amount, string calldata concept) external {
        Profile memory p = profiles[msg.sender];
        if (!p.isSet) revert NoProfile();

        bytes memory refBytes = bytes(ref);
        if (refBytes.length == 0) revert EmptyRef();
        if (refBytes.length > MAX_REF_LEN) revert RefTooLong();
        if (bytes(concept).length > MAX_CONCEPT_LEN) revert ConceptTooLong();
        if (amount == 0) revert InvalidAmount();

        bytes32 refHash = keccak256(refBytes);
        if (receipts[msg.sender][refHash].issuedAt != 0) revert ReceiptExists();

        receipts[msg.sender][refHash] = Receipt({
            amount: amount,
            taxBps: p.taxBps,
            utcOffsetMin: p.utcOffsetMin,
            issuedAt: uint40(block.timestamp),
            paid: false,
            payer: address(0),
            paidAt: 0,
            concept: concept
        });

        _freelancerRefs[msg.sender].push(ref);

        emit Issued(msg.sender, refHash, ref, amount, p.taxBps, p.utcOffsetMin);
    }

    function pay(address freelancer, string calldata ref) external payable nonReentrant {
        // On Arc, a transfer to address(0) reverts; credit to pendingNet[address(0)] is unrecoverable.
        if (freelancer == address(0)) revert UnknownReceipt();

        bytes32 refHash = keccak256(bytes(ref));
        Receipt storage r = receipts[freelancer][refHash];

        if (r.issuedAt == 0) revert UnknownReceipt();
        if (r.paid) revert AlreadyPaid();
        if (msg.value != r.amount) revert WrongAmount();

        uint256 reserve = r.taxBps == 0 ? 0 : (r.amount * r.taxBps + BPS - 1) / BPS;
        uint256 net = r.amount - reserve;

        // CEI: all state changes before any external call.
        r.paid = true;
        r.payer = msg.sender;
        r.paidAt = uint40(block.timestamp);

        reserves[freelancer] += reserve;
        totalReserves += reserve;

        uint256 period = periodOf(block.timestamp, r.utcOffsetMin);
        monthlyGross[freelancer][period] += r.amount;

        // Push net to freelancer with bounded gas stipend.
        // nonReentrant guard is already active, so any re-entrant call from the
        // freelancer's receive() will hit the guard and revert — the low-level
        // call returns ok=false, and we fall through to the deferred path.
        // solhint-disable-next-line avoid-low-level-calls
        (bool ok,) = freelancer.call{value: net, gas: NET_PUSH_GAS}("");

        if (ok) {
            // Happy path: net delivered in this transaction.
            emit Paid(freelancer, refHash, ref, msg.sender, r.amount, net, reserve, period, true);
        } else {
            // Fallback: credit net to pendingNet for later claim via claimNet().
            pendingNet[freelancer] += net;
            totalPendingNet += net;
            emit NetDeferred(freelancer, refHash, net);
            emit Paid(freelancer, refHash, ref, msg.sender, r.amount, net, reserve, period, false);
        }
    }

    function withdrawReserve(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();

        uint256 available = reserves[msg.sender];
        if (amount > available) revert InsufficientReserve();

        reserves[msg.sender] = available - amount;
        totalReserves -= amount;

        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit ReserveWithdrawn(msg.sender, amount);
    }

    function claimNet() external nonReentrant {
        uint256 amount = pendingNet[msg.sender];
        if (amount == 0) revert InvalidAmount();
        pendingNet[msg.sender] = 0;
        totalPendingNet -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit NetClaimed(msg.sender, amount);
    }

    function profileOf(address freelancer) external view returns (uint16 taxBps, int16 utcOffsetMin, bool isSet) {
        Profile memory p = profiles[freelancer];
        return (p.taxBps, p.utcOffsetMin, p.isSet);
    }

    function receiptOf(address freelancer, string calldata ref) external view returns (Receipt memory) {
        return receipts[freelancer][keccak256(bytes(ref))];
    }

    function receiptCount(address freelancer) external view returns (uint256) {
        return _freelancerRefs[freelancer].length;
    }

    function receiptRefAt(address freelancer, uint256 index) external view returns (string memory) {
        return _freelancerRefs[freelancer][index];
    }

    function reserveOf(address freelancer) external view returns (uint256) {
        return reserves[freelancer];
    }

    function monthGross(address freelancer, uint256 period) external view returns (uint256) {
        return monthlyGross[freelancer][period];
    }

    // Invariant: address(this).balance >= totalReserves + totalPendingNet.
    function totalLiabilities() external view returns (uint256) {
        return totalReserves + totalPendingNet;
    }

    function currentPeriod(address freelancer) external view returns (uint256) {
        Profile memory p = profiles[freelancer];
        if (!p.isSet) revert NoProfile();
        return periodOf(block.timestamp, p.utcOffsetMin);
    }

    function periodOf(uint256 timestamp, int16 utcOffsetMin) public pure returns (uint256) {
        int256 shifted = int256(timestamp) + int256(utcOffsetMin) * 60;
        uint256 ts = shifted < 0 ? 0 : uint256(shifted);

        uint256 daysSinceEpoch = ts / 86400;

        uint256 z = daysSinceEpoch + 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 y = yoe + era * 400;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        uint256 m = mp < 10 ? mp + 3 : mp - 9;
        if (m <= 2) y += 1;

        return y * 12 + (m - 1);
    }
}
