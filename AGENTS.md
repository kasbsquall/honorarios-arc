# Honorarios

> Built with Arc Studio - money-powered apps in minutes

Tax reserve contract for freelancers paid by foreign clients in native USDC on Arc.

---

## Contract Deployments

### Honorarios.sol — v2 (current, push-with-fallback)

| Chain | Address | Explorer |
|-------|---------|---------|
| Arc Testnet | `0xe4710978da3541cd80468775324aab602e1def28` | [View](https://explorer.testnet.arc.io/address/0xe4710978da3541cd80468775324aab602e1def28) |

**Deploy tx:** `0x318263de6fe1ae4a15d0a9f9698438d3994f1ea54510428a1de2a4646b2aad8a`

### Demo transactions v2 (Arc Testnet, 2026-10-25)

| Step | Function | Tx Hash |
|------|----------|---------|
| 1 | setProfile(800, -300) | `0x561084f5...` |
| 2 | issue("E001-1", 1e18, "Website redesign, October") | `0xb0a8b53b...` |
| 3 | pay(freelancer, "E001-1") — +0.92 USDC to freelancer in same tx | `0xc1775d4a...` |
| 4 | pay again (AlreadyPaid revert — broadcast) | `0xbd15e037...` |
| 5 | withdrawReserve(4e16) | `0xc70207d6...` |

### Honorarios.sol — v1 (previous, pure pull model)

| Chain | Address | Explorer |
|-------|---------|---------|
| Arc Testnet | `0x33d6dec517e52b84ac7044518d1496d5adf9ba8d` | [View](https://explorer.testnet.arc.io/address/0x33d6dec517e52b84ac7044518d1496d5adf9ba8d) |

## Design decisions

- **Push-with-fallback for net:** pay() tries `freelancer.call{value: net, gas: NET_PUSH_GAS}("")`. For an EOA freelancer, net lands in her wallet in the same transaction (netSent=true). If the push fails (blocklisted address, rejecting contract, re-entrant call hitting the nonReentrant guard), net is deferred to pendingNet[freelancer] and NetDeferred is emitted (netSent=false). claimNet() handles deferred amounts.
- **NET_PUSH_GAS = 100_000:** bounds the gas the freelancer's receive() can consume, preventing gas-bomb attacks while being sufficient for any normal EOA receive.
- **Zero-address guard on pay():** pay(address(0), ...) reverts UnknownReceipt — prevents funds being locked in pendingNet[address(0)].
- **Rate snapshot:** taxBps and utcOffsetMin are copied from the profile at issue time, not at pay time.
- **Ceil rounding:** reserve = (amount * taxBps + BPS - 1) / BPS — rounding favors the reserve (SUNAT).
- **periodOf:** Howard Hinnant era-based civil_from_days algorithm, UTC-offset-shifted. Period = year*12 + (month-1).
- **No owner, no admin, no pause, no upgrade.** Nobody but the freelancer moves her own reserve or net.

## Tech Stack

- Contracts: Solidity 0.8.28 + Foundry
- Chain: Arc Testnet (native USDC = msg.value, 18 decimals)
- OpenZeppelin: ReentrancyGuard only

## Key Files

- `contracts/Honorarios.sol` — main contract
- `contracts/test/Honorarios.*.t.sol` — 48 unit/fuzz/invariant tests
- `contracts/contract-metadata/Honorarios.json` — deployment metadata
- `src/deployments.ts` — contract addresses + chain IDs per network
- `src/abi.ts` — typed ABI
- `src/lib/contract.ts` — viem public client with fallback RPCs + multicall + chunked getLogs
- `src/lib/csv.ts` — CSV builder for monthly statements
- `src/tax/peru.ts` — Peru fourth-category tax logic (pure TypeScript, no DOM)
- `src/proof.ts` — demo transaction list for /proof page
- `scripts/seed-testnet.ts` — one-shot script to populate real testnet receipts

## Mainnet deployment checklist

1. Deploy `contracts/Honorarios.sol` (exact same bytecode as testnet — no changes)
2. Set `VITE_HONORARIOS_ADDRESS_MAINNET=0x...` in .env
3. Set `VITE_DEPLOY_BLOCK_MAINNET=<block>` in .env
4. Set `VITE_NETWORK=mainnet` in .env
5. Run `FREELANCER_KEY=0x... CLIENT_KEY=0x... bun run scripts/seed-testnet.ts` (or mainnet equivalent) to populate demo data
6. Update `VITE_DEMO_FREELANCER` with the freelancer address from the seeding script
7. Fill `src/proof.ts` DEMO_TRANSACTIONS with the hashes from step 5
8. Run `bun run build` and deploy `dist/`

## To Run / Test

```bash
bun run contracts:build   # forge build
bun run contracts:test    # forge test
```
