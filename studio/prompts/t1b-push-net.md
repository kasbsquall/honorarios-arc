Change one design decision in contracts/Honorarios.sol, then re-test, re-audit and redeploy to Arc testnet.

## Why

Your round-1 review moved the freelancer's net to a pull model (pendingNet + claimNet). That fixed a real risk, but it breaks the product's core promise: "the client pays, and the net lands in your wallet in the same transaction". With pull, every single payment needs a second transaction from the freelancer before she sees her money.

Keep both properties with push-with-fallback:

## Change

In pay(), after all state updates (receipt marked paid, reserve credited, monthlyGross updated), try to send `net` to the freelancer with a bounded gas stipend:

- `uint256 public constant NET_PUSH_GAS = 100_000;`
- `(bool ok,) = freelancer.call{value: net, gas: NET_PUSH_GAS}("");`
- If ok: nothing is credited to pendingNet.
- If not ok (blocklisted address, a contract that rejects or burns gas, or a re-entrant call that hits the guard): credit `net` to `pendingNet[freelancer]` and `totalPendingNet`, and emit `NetDeferred(freelancer, refHash, net)`. The payment still succeeds and the receipt is still paid.
- claimNet() stays as it is, for deferred amounts only.
- Add `bool netSent` as the last field of the `Paid` event.
- pay() stays nonReentrant. Effects before the external call.

Nothing else changes: same functions, same errors, same views, same compiler version, optimizer runs and evm_version in foundry.toml.

## Tests to update or add

1. Split, EOA freelancer: 1 USDC at 800 bps; the freelancer's native balance increases by exactly 0.92 USDC inside the pay() transaction; pendingNet stays 0; reserve 0.08; Paid has netSent = true.
2. A freelancer contract that rejects native USDC: pay() succeeds, the receipt is paid, pendingNet = net, NetDeferred emitted, netSent = false; claimNet() from that contract reverts TransferFailed while it keeps rejecting.
3. A freelancer contract whose receive() burns all gas: pay() still succeeds with the net deferred, and the payer's transaction does not run out of gas.
4. A freelancer contract whose receive() re-enters pay() or withdrawReserve(): no double credit; the net is deferred.
5. A freelancer contract that accepts on its second attempt: first payment deferred, then claimNet() delivers it.
6. Invariant: address(this).balance == totalReserves + totalPendingNet across random sequences that include rejecting and accepting freelancers (keep >= if you must account for forced native credits, and say why).
7. Keep every other existing test passing.

Run the full suite and report the count. Re-run both auditors and Slither on the changed contract and fix any real finding.

## Deploy and demo

Redeploy Honorarios to Arc testnet. Run the demo again from two funded addresses: setProfile(800, -300); issue("E001-1", 1 USDC, "Website redesign, October"); client pays it (show the freelancer's balance before and after: +0.92 in the same transaction); the client's second pay of E001-1 reverts AlreadyPaid (broadcast it if the tooling allows, so it shows as a failed transaction on the explorer; otherwise say it was eth_call only); freelancer withdraws 0.04 USDC of the reserve. Report the new contract address and every transaction hash.
