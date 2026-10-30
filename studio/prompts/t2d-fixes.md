Small fix turn for the Honorarios app. We ran your build against a local Arc chain with the real contract and the full demo script; the proof page and pay page work after these fixes. Do not touch contracts/ or the design. Keep it tight.

1. Multicall on Arc mainnet. `arcMainnet` in src/config.ts has no `contracts.multicall3`, so viem rejects every batched read and /proof shows "Could not load proof data". Add `contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } }` (Multicall3 is deployed at that address on Arc mainnet and testnet, per docs.arc.io contract addresses). Make sure the testnet chain object used by the app also has it.

2. Share links are broken with `base: './'`. `ownBase()` in src/lib/share.ts builds `window.location.origin + BASE_URL`, which becomes `https://host./` with a relative base. Build the base from `window.location.origin + window.location.pathname` (drop a trailing `index.html` and trailing slash) so links work at the root and under a GitHub Pages sub-path. Keep the Studio iframe handshake as it is. Add a unit test for the base builder.

3. Amounts must always add up. A pending 0.10 USDC receipt at 8% shows reserve 0.00 and net 0.09. Wherever the app shows amount, reserve and net (proof table, receipt card, pay page, dashboard), format USDC with as many decimals as needed up to 6, minimum 2, trimming trailing zeros, so reserve + net equals the amount on screen. Compute the reserve for a pending receipt exactly as the contract does: ceil(amount * taxBps / 10000), with the receipt's own taxBps. Unit test the formatter and the reserve calculation (0.10 at 800 bps gives 0.008 and 0.092).

4. /proof layout: the five counters leave an empty grey block in the second row. Lay them out as one row of five on desktop, wrapping cleanly on smaller screens, with no filler block. In each Demonstrations row show the shortened tx hash (0x1234…abcd) as the link text next to the external-link icon.

5. index.html: title "Honorarios", and a meta description: "Sets aside the tax your foreign client doesn't withhold, in the same USDC payment on Arc."

6. Run unit tests, typecheck, lint and build. Report results and the files changed.
