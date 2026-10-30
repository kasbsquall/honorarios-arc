One-bug fix turn for the Honorarios app. Do not touch contracts/ or the design.

The contract is now live on Arc mainnet and the freelancer's profile is set on chain (`profileOf` returns 800, -300, true), but the dashboard shows "Set up profile" and "Collected this month" stays at 0.

Cause: `profileOf` has three named outputs, and viem returns multi-output reads as an array `[taxBps, utcOffsetMin, isSet]`, not an object. Both readers cast the result to an object and read `.isSet`, which is always undefined:

- `src/hooks/useAccountData.ts` (the multicall result `profileRes.result`)
- `src/pages/Issue.tsx` (the `readContract` in the profile `useEffect`, so the split preview always falls back to 8%)

Fix both to read the tuple by index (or a small shared helper that accepts the tuple), keep the types strict with no `as unknown as`, and add a unit test for the helper with the tuple `[800, -300, true]` and the unset tuple `[0, 0, false]`. Check that no other multi-output read (`receiptOf` returns a struct, which viem does return as an object; leave it if it is correct) has the same problem.

Run unit tests, typecheck, lint and build. Report results and the files changed.
