Finish the Honorarios app so it is ready for Arc mainnet. The previous app turn stopped at the daily limit with 3 TypeScript errors and some lint findings. DESIGN.md (in context/) still rules the look; do not redesign. Do not change contracts/Honorarios.sol or its tests: the mainnet contract will be the exact bytecode you already tested and deployed to testnet.

Work in this order and stop to report if you run low on budget.

1. Fix the remaining TypeScript and lint errors.

2. Network config.
- Two networks selected by VITE_NETWORK (testnet | mainnet). Mainnet is Arc mainnet, chain id 5042, explorer https://explorer.arc.io. Testnet keeps the current contract 0xe4710978da3541cd80468775324aab602e1def28.
- Mainnet contract address and its deploy block come from VITE_HONORARIOS_ADDRESS_MAINNET and VITE_DEPLOY_BLOCK_MAINNET (empty for now; the app shows a clear "not deployed yet" state when empty, never a crash).
- RPC resilience: public Arc RPCs return HTTP 429. Use viem `fallback([...])` transports. Mainnet: https://rpc.mainnet.arc.io, https://rpc.drpc.mainnet.arc.io, https://rpc.quicknode.mainnet.arc.io, https://rpc.blockdaemon.mainnet.arc.io. Testnet: https://rpc.testnet.arc.io. Batch reads with multicall, retry once on 429 before the error state.
- eth_getLogs is slow on Arc: query events from the deploy block in chunks (at most 9,000 blocks per call), and cache results in memory for the session.
- Build with a relative base (`base: './'`) and hash routing so the static build works on GitHub Pages under a sub-path.

3. Payment page: if the connected wallet has less USDC than the receipt amount, show the amount missing and a link to https://portal.arc.io/deposit/fiat ("Get USDC on Arc"). Keep the existing pay flow otherwise.

4. Monthly statement (Dashboard): a "Download month (CSV)" button for the selected tax month. Built only from on-chain data: one row per paid receipt with ref, concept, payer, paid date and time in the freelancer's tax month time zone, gross, reserve, net, net delivered or pending, tx hash. Header row in English. Unit test the CSV builder (escaping of commas and quotes in concept, rounding of 6-decimal USDC amounts).

5. Proof page at /proof, readable with no wallet connected, for one freelancer address (VITE_DEMO_FREELANCER, or ?f=0x... in the URL):
- Counters read from the contract: receipts issued, receipts paid, USDC paid through the contract (sum of paid receipt amounts), USDC currently in reserve (reserveOf), contract totalLiabilities.
- A table of every receipt with status, amount, reserve, net, payer and a link to its payment tx on the explorer.
- "Demonstrations" section: a list of transaction hashes configured in src/proof.ts (an array of { hash, label, expect: 'success' | 'reverted' }). For each one the page calls eth_getTransactionReceipt and shows the label, the real status read from chain (success or reverted), a match or mismatch mark against `expect`, and the explorer link. Leave the array empty with a comment; we fill it after the mainnet run.
- A short "How to verify" paragraph and the contract address linked to the explorer.
- Link /proof from the header.

6. Real testnet data for the sample account, only if budget remains. Your earlier demo ran on a local anvil fork, so the testnet contract has no receipts. From your sandbox wallets on the REAL Arc testnet: setProfile(800, -300) from a freelancer address; issue E001-1 (1 USDC), E001-2 (0.5 USDC), E001-3 (0.25 USDC); pay E001-1 and E001-2 from a different client address; leave E001-3 pending. Confirm every hash with eth_getTransactionReceipt on https://rpc.testnet.arc.io before reporting it, and set that freelancer as the testnet VITE_DEMO_FREELANCER default.

7. Run the unit tests, the typecheck, lint and `bun run build`. Report each result, the list of files you changed, any hash you report with its confirmed status, and the preview URL.
