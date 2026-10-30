One-bug fix turn for the Honorarios app. Do not touch contracts/ or the design.

On Arc mainnet a client just paid E001-1. On chain the net (0.46 USDC) reached the freelancer in the same transaction: `pendingNet(freelancer)` is 0 and the `Paid` event has `netSent = true`. The pay page still showed "The freelancer will claim her net payment from the app."

Cause: `src/pages/Pay.tsx` parses `netSent` by hand from the raw log data and takes the last 32-byte word. `Paid` has a dynamic `string ref` among its non-indexed fields, so the data is `[offset, amount, net, reserve, period, netSent, len, ref bytes]` and the last word is the padded ref, not `netSent`. It also picks the log by `topics.length === 4` and data length, which is fragile.

Fix: decode the receipt logs with viem `parseEventLogs` (or `decodeEventLog`) against the contract ABI, filtered to the `Paid` event from the Honorarios address, and read `args.netSent`. Treat a `NetDeferred` event in the same receipt as deferred. Put the decoding in a small pure helper and unit test it with an encoded `Paid` log for netSent true and false, using a ref like "E001-1" so the string is present.

Run unit tests, typecheck, lint and build. Report results and the files changed.
