Build the smart contract for "Honorarios", a tax reserve for freelancers paid by clients abroad. Plan it, write it, test it, run your security review, fix what it finds, and deploy it to Arc testnet. Do not build the app yet; that is the next turn.

## The problem

A freelancer paid by a foreign client receives the full invoice amount, because a foreign client has no duty to withhold tax. In Peru, a local client would withhold 8% for the tax authority (SUNAT); a foreign one does not, so the freelancer must prepay that 8% herself, and by the due date the money is often spent. Honorarios sets the money aside at the moment the payment arrives.

## Flow

1. The freelancer saves a profile: the share of each payment to reserve (basis points) and the UTC offset in minutes of her tax month (Peru: 800 bps, -300).
2. The freelancer issues a receipt: a reference (like "E001-1"), an amount, a short concept. The receipt copies the profile's rate and offset at that moment.
3. The client pays the receipt in native USDC (msg.value). In the same transaction the contract sends the net to the freelancer's wallet and keeps the reserve in the contract, credited to her.
4. Only the freelancer can withdraw her reserve, whenever she decides.

## Arc facts that matter

- USDC is the native gas token. Native value has 18 decimals. Pay with msg.value; do not use the ERC-20 interface at 0x3600000000000000000000000000000000000000 and do not mix msg.value with balanceOf (6 decimals).
- A value transfer to address(0) reverts on Arc. Native transfers can revert for blocklisted addresses even with enough balance.

## Contract: Honorarios.sol (Solidity 0.8.x, no external dependencies beyond OpenZeppelin ReentrancyGuard if you need it)

No owner, no admin, no fee, no upgrade, no pause. Nobody but a freelancer can move her own reserve.

Constants: MAX_TAX_BPS = 5000 (50%), BPS = 10000, MIN_OFFSET = -720, MAX_OFFSET = 840 (minutes), MAX_REF_LEN = 32 bytes, MAX_CONCEPT_LEN = 80 bytes.

State:
- profile per freelancer: taxBps (uint16), utcOffsetMin (int16), isSet (bool)
- receipt per (freelancer, ref): amount (uint256, 18-decimal native units), taxBps, utcOffsetMin, issuedAt, paid (bool), payer, paidAt, concept (string)
- list of refs per freelancer, in issue order, so a frontend can enumerate receipts with view calls only (no event scanning)
- reserve per freelancer (uint256)
- monthGross per (freelancer, period): sum of gross paid in that tax month

Functions:
- setProfile(uint16 taxBps, int16 utcOffsetMin): caller is the freelancer. Reverts TaxRateTooHigh if taxBps > 5000; InvalidUtcOffset outside [-720, 840]. Emits ProfileSet(freelancer, taxBps, utcOffsetMin).
- issue(string ref, uint256 amount, string concept): caller is the freelancer. Reverts NoProfile if no profile; EmptyRef if ref is empty; RefTooLong / ConceptTooLong over the limits; InvalidAmount if amount == 0; ReceiptExists if the ref was already used by this freelancer (paid or not). Copies taxBps and utcOffsetMin from the profile. Appends ref to the freelancer's list. Emits Issued(freelancer, refHash, ref, amount, taxBps, utcOffsetMin).
- pay(address freelancer, string ref) payable: anyone may pay. Reverts UnknownReceipt if it was never issued; AlreadyPaid if paid; WrongAmount if msg.value != receipt.amount (the receipt sets the amount, the payer does not). reserve = ceil(amount * taxBps / 10000); net = amount - reserve. Mark paid, record payer and paidAt, add reserve to the freelancer's balance, add amount to monthGross[freelancer][periodOf(block.timestamp, receipt.utcOffsetMin)], then send net to the freelancer (checks-effects-interactions; revert TransferFailed if the send fails). Emits Paid(freelancer, refHash, ref, payer, amount, net, reserve, period).
- withdrawReserve(uint256 amount): caller withdraws from her own reserve to her own address. Reverts InvalidAmount if 0; InsufficientReserve if amount > reserve. Emits ReserveWithdrawn(freelancer, amount).
- Views: profileOf(freelancer); receiptOf(freelancer, ref); receiptCount(freelancer); receiptRefAt(freelancer, index); reserveOf(freelancer); monthGross(freelancer, period); currentPeriod(freelancer) (uses the profile's offset); periodOf(uint256 timestamp, int16 utcOffsetMin) pure.

periodOf returns year * 12 + (month - 1) for the timestamp shifted by the offset, using Howard Hinnant's civil_from_days algorithm (days since 1970-01-01, era-based). Clamp a negative shifted time to 0.

Use custom errors with the names above.

## Tests (Foundry). Write all of these, plus fuzz and invariant tests

1. Profile: rejects 5001 bps and offsets -721 and 841; accepts 0, 5000, -720, 840.
2. issue requires a profile; requires the freelancer as caller (a stranger cannot issue in someone else's name, so nobody can inflate her month); rejects empty, too long, duplicate refs; rejects amount 0.
3. A receipt keeps its rate: issue at 1000 bps, change the profile to 2000 bps, pay; the reserve is 10% of the amount.
4. pay reads the amount from the receipt: paying less or more reverts WrongAmount.
5. A receipt is paid once: a second pay reverts AlreadyPaid; paying a ref nobody issued reverts UnknownReceipt.
6. Split: 100 USDC at 800 bps gives net 92 and reserve 8 (in 18-decimal units); the freelancer's balance increases by the net in the same transaction; the contract balance equals the sum of all reserves.
7. Rounding favors the reserve: for odd amounts the reserve rounds up; net + reserve == amount for any rate in [0, 5000] and any amount (fuzz).
8. Only the owner withdraws: a third party cannot withdraw someone else's reserve; withdrawing more than the reserve reverts; a partial withdrawal leaves the rest.
9. Tax month in the freelancer's time zone: with offset -300, 2026-11-01 04:59:59 UTC belongs to October 2026 and 2026-11-01 05:00:00 UTC to November 2026. Two freelancers with different offsets close their month at different instants. Check periodOf against known dates including 2024-02-29 and 2000-03-01.
10. Enumeration: receiptCount and receiptRefAt return refs in issue order.
11. Reentrancy: a freelancer contract that re-enters pay or withdrawReserve on receive cannot double-credit or double-withdraw.
12. A freelancer address that rejects native USDC makes pay revert as a whole (no receipt marked paid, no reserve credited).
13. Invariant: address(this).balance == sum of reserves of all freelancers touched in the run.

Report the number of tests and whether they pass. Then run your security review and fix every finding, re-running the tests.

## Deploy

Deploy Honorarios to Arc testnet. Then, on testnet, run this demo from two funded addresses (freelancer and client): setProfile(800, -300); issue("E001-1", 1 USDC, "Website redesign, October"); client pays it; client tries to pay it again (expected revert AlreadyPaid); freelancer withdraws 0.04 USDC of the reserve. Report the contract address and each transaction hash, including the failed one if the tooling submits it.

Keep the compiler version and optimizer settings in foundry.toml fixed: the same compiled bytecode will later be deployed to Arc mainnet unchanged.
