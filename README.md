# Honorarios

A freelancer in Peru who bills a foreign client gets paid in full, because the client withholds nothing. The tax is still due, and she has to set it aside herself. Honorarios does it inside the payment: when the client pays a receipt in USDC on Arc, one contract call sends the net to her wallet and locks the tax reserve, at the rate in force when the receipt was issued. She withdraws the reserve when she files.

Built with [Arc Studio](https://studio.arc.io). Live on Arc mainnet.

| | |
|---|---|
| App | https://kasbsquall.github.io/honorarios-arc/ |
| Proof page, no wallet needed | https://kasbsquall.github.io/honorarios-arc/#/proof |
| Contract on Arc mainnet | [`0x400b41f172101ca95e3334291f69fb4d59ca6ca0`](https://explorer.arc.io/address/0x400b41f172101ca95e3334291f69fb4d59ca6ca0) |
| Verified source | [Sourcify, exact match](https://repo.sourcify.dev/5042/0x400b41f172101ca95e3334291f69fb4d59ca6ca0) |
| Pay an open receipt yourself (0.10 USDC) | [E001-3](https://kasbsquall.github.io/honorarios-arc/#/pay/0xdf33091E2818854080E2C178d094FBD945f32717/E001-3) |

Judges: [JUDGE.md](JUDGE.md) checks every claim in three minutes, one transaction per guarantee.

## What the contract guarantees

- The net and the reserve move in the same transaction as the payment. If the push to the freelancer fails, the net is held for her to claim and the payment still goes through.
- A receipt is paid once, for its exact amount. A second payment reverts with `AlreadyPaid`, a wrong amount with `WrongAmount`.
- The reserve rate is copied onto the receipt when it is issued. Raising the rate later does not change receipts already sent.
- Rounding favours the reserve: `ceil(amount * taxBps / 10000)`.
- Monthly totals use the freelancer's own time zone, so a payment at 11 p.m. in Lima on the 31st counts in that month.
- No owner, no admin, no pause, no upgrade. Only the freelancer moves her reserve.

All of it is shown on mainnet in [JUDGE.md](JUDGE.md) and on the [/proof](https://kasbsquall.github.io/honorarios-arc/#/proof) page, which reads every number from the contract and checks every listed transaction receipt live.

## Screens

| Route | What it is |
|---|---|
| `/` | Sample account, read-only |
| `/setup` | Connect a wallet, choose the Peru preset (8%, Lima time) or a custom rate |
| `/issue` | Issue a receipt and get a payment link and QR code |
| `/pay/:freelancer/:ref` | The client's payment page, with the split shown before paying |
| `/dashboard` | Reserve held, month collected, receipts, CSV statement for the month, reserve withdrawal |
| `/proof` | Public counters, all receipts and the mainnet demonstrations |

## How it was built

Arc Studio wrote the contract, its 48 Foundry tests (unit, fuzz, invariant, reentrancy) and the app, and ran its own auditors on the contract. Every prompt sent to Studio is in [`studio/prompts/`](studio/prompts), in order, and [JUDGE.md](JUDGE.md) lists what each turn changed and the short list of files written by hand. Two of the turns fix bugs that only showed up once real USDC moved on mainnet.

## Run it

```bash
bun install          # or: npm install --legacy-peer-deps
bun run dev          # app, reads Arc mainnet with .env.production values
bun run test         # 60 unit tests (Peru tax logic, CSV, decoders, formatting)
bun run contracts:test   # 48 Foundry tests
bun run build        # static build in dist/, works under a GitHub Pages sub-path
```

`VITE_NETWORK` picks `mainnet` or `testnet`. The mainnet contract address, its deploy block and the demo freelancer are public and set in `.env.production`.

## Limits

Not audited by a third party. The Peru figures are an estimate; the app does not file or pay anything to the tax authority. A client with no USDC on Arc needs an on-ramp first, and the payment page links to Arc's deposit page. The mainnet demo payments were made between two wallets of the builder; see the disclosure in [JUDGE.md](JUDGE.md).
