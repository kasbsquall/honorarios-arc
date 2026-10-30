# JUDGE.md: verify Honorarios in three minutes

Everything below is on Arc mainnet (chain id 5042) and can be checked on https://explorer.arc.io with no wallet.

## 1. The contract

| | |
|---|---|
| Contract | `0x400b41f172101ca95e3334291f69fb4d59ca6ca0` · https://explorer.arc.io/address/0x400b41f172101ca95e3334291f69fb4d59ca6ca0 |
| Deploy tx | `0x1ac344ea8c4f050ace2458efe3585cebe40b86c4ee58250dafbd374bbc150779` (block 28583446) |
| Source | `contracts/Honorarios.sol`, written by Arc Studio, verified on Sourcify: https://repo.sourcify.dev/5042/0x400b41f172101ca95e3334291f69fb4d59ca6ca0 (exact match) |
| Arc Studio project | https://studio.arc.io/app/edf5e283-9f27-4adf-8223-30a54f411022 |
| Same code as Studio's testnet deploy | runtime bytecode of `0x400b41f172101ca95e3334291f69fb4d59ca6ca0` on mainnet equals that of `0xe4710978da3541cd80468775324aab602e1def28` on Arc testnet, byte for byte. Check: `cast code <address> --rpc-url <rpc>` on both networks and compare. |

## 2. The full lifecycle, one transaction per guarantee

Freelancer = wallet A `0xdf33091E2818854080E2C178d094FBD945f32717`. Client = wallet B `0xa3F834376929D754Bb160f00eD5261BEFa2c5b23`. Both belong to the builder; see the disclosure below.

| # | What it shows | Tx | Expected |
|---|---|---|---|
| 1 | Deploy, same bytecode as Studio's testnet deploy | [`0x1ac344ea…`](https://explorer.arc.io/tx/0x1ac344ea8c4f050ace2458efe3585cebe40b86c4ee58250dafbd374bbc150779) | success |
| 2 | `setProfile(800, -300)`: Peru preset, 8% reserve, Lima time | [`0xed3bc2b6…`](https://explorer.arc.io/tx/0xed3bc2b6eddff4d7926370a054cc6f0c5556c15fca47c26f10975a6ef3914dc2) | success |
| 3 | `issue` E001-1 for 0.50 USDC | [`0xa6ab5854…`](https://explorer.arc.io/tx/0xa6ab5854294e878d08c72151bfaa5d825c142f63b8d9ffff17935ae674c8c553) | success |
| 4 | `issue` E001-2 for 0.25 USDC | [`0x324132c4…`](https://explorer.arc.io/tx/0x324132c480032d8805a987ff6cf3e12eccea31ef6ff33d8bf57e0417dc398cf0) | success |
| 5 | `issue` E001-3 for 0.10 USDC, left pending | [`0x3c790437…`](https://explorer.arc.io/tx/0x3c7904377e2c22aabce22bc489564fa15388303941656741d064a47d8119a089) | success |
| 6 | `pay` E001-1: 0.46 net reaches the freelancer and 0.04 goes to the reserve in the same transaction | [`0x30c9e7c7…`](https://explorer.arc.io/tx/0x30c9e7c7b325a1a0322a328ccda7d1458ef81d23bbdb8ce8f4e0e972cff36a72) | success |
| 7 | `pay` E001-1 again: AlreadyPaid | [`0xbaf34646…`](https://explorer.arc.io/tx/0xbaf34646f3540728d2885cd2897c4286f1f4df56124e075ecebbe6f90f4cca8c) | reverted |
| 8 | `pay` E001-2 with 0.20 instead of 0.25: WrongAmount | [`0x2809a749…`](https://explorer.arc.io/tx/0x2809a749917dd21752b0d9cc04d43876507850f6d69ed3f24cafa1989334fc0c) | reverted |
| 9 | `setProfile(1000, -300)` after E001-2 was issued | [`0x88f827de…`](https://explorer.arc.io/tx/0x88f827de17c35c3db74197e97215a3e042bd9ac9ca6c29999e7971a4714cd70c) | success |
| 10 | `pay` E001-2: reserve is 0.02, the 8% in force when it was issued, not 10% | [`0xed3e6c04…`](https://explorer.arc.io/tx/0xed3e6c04994250c09f7cd83f74664fbb9c4bea1ee3bde17349064b5dec59daab) | success |
| 11 | `withdrawReserve` of the full 0.06; reserve and total liabilities back to 0 | [`0x6daa238c…`](https://explorer.arc.io/tx/0x6daa238c06d1b36d386d7f1b8be0341e67664b506f152babbdbaf46111bc12a2) | success |

Receipt `E001-3` (0.10 USDC) is left pending on purpose. Pay it yourself and watch /proof update: https://kasbsquall.github.io/honorarios-arc/#/pay/0xdf33091E2818854080E2C178d094FBD945f32717/E001-3

## 3. Read it from the app, no wallet

- /proof: https://kasbsquall.github.io/honorarios-arc/#/proof . Counters (receipts issued and paid, USDC paid through the contract, USDC in reserve, total liabilities) are read live from the contract. Each row of "Demonstrations" calls `eth_getTransactionReceipt` and shows the status the chain returns next to the status we expected.
- Dashboard for the freelancer's month, with a CSV statement built only from on-chain data.

## 4. How Arc Studio was used

All prompts are in `studio/prompts/`, in the order they were sent:

| Turn | Prompt | What Studio did |
|---|---|---|
| t1 | `t1-contract.md` | Wrote `Honorarios.sol` and 48 Foundry tests (unit, fuzz, a stateful invariant suite of 256 runs x 500 calls, reentrancy and gas-burning receivers), ran its solidity and functional auditors for two rounds plus Slither, deployed to Arc testnet. |
| t1b | `t1b-push-net.md` | Its auditor had moved the net to a pull model. We asked for push-with-fallback so the net still reaches the freelancer in the same payment; Studio changed the contract, re-tested and re-audited it. |
| t2 | `t2-app.md` | Built the Vite + React + wagmi app (setup, receipts, payment page, dashboard, Peru panel with unit tests) from `DESIGN.md`. Stopped at the daily usage limit. |
| t2c | `t2c-v2-app.md` | Fixed the remaining type errors, added Arc mainnet with fallback RPCs, chunked log queries, the "get USDC on Arc" path, the monthly CSV and /proof. |
| t2d | `t2d-fixes.md` | Fixes we found by running the app against a local Arc chain with the real contract: Multicall3 on mainnet, share links under a relative base, amounts that always add up, /proof layout. |
| t2e | `t2e-profile-tuple.md` | Found once the contract was live on mainnet: the dashboard read `profileOf` as an object, but viem returns multi-output reads as a tuple, so a saved profile showed as missing. Studio added a tested decoder and fixed both readers. |
| t2f | `t2f-netsent.md` | Found on the first mainnet payment: the pay page parsed `netSent` from raw log words and read the padded `ref` string instead, so it said the net was deferred when it had already reached the freelancer. Studio replaced it with ABI decoding (`parseEventLogs`) and tests. |

Our own checks: we re-ran Studio's Foundry tests locally with Arc Foundry, compiled Studio's source locally, and rehearsed the whole mainnet script on a local arc-anvil chain before spending real USDC.

## 5. What was done by hand (complete list)

- `README.md` and this `JUDGE.md`.
- `src/proof.ts`: the list of mainnet transaction hashes shown on /proof, and `.env` values for the mainnet contract address and deploy block.
- `tools/firmar/`: a small page that sends Studio's unmodified creation bytecode from the builder's browser wallet (Arc Studio deploys only to testnet) and sends the two payments that must be rejected, with a fixed gas limit so the wallet does not refuse to broadcast them. It holds no keys.

## 6. Disclosure

Wallets A and B both belong to the builder. These are builder-funded payments with real USDC on Arc mainnet, made to show every rule of the contract on chain. They are not customer traction, and Honorarios has no customers yet. About 0.75 USDC moved through the contract; gas for the whole script was about 0.067 USDC.

## 7. Known limits

Unaudited by a third party. The Peru figures are an estimate, and the app does not file or pay anything to the tax authority. A client with no USDC on Arc needs an on-ramp first (the payment page links to Arc's fiat deposit).
