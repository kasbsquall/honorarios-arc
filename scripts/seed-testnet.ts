/**
 * seed-testnet.ts — populate real Arc Testnet data for the sample account.
 *
 * Usage (requires funded wallets):
 *   FREELANCER_KEY=0x... CLIENT_KEY=0x... bun run scripts/seed-testnet.ts
 *
 * What it does:
 *   1. setProfile(800, -300) from the freelancer wallet
 *   2. issue E001-1 (1 USDC), E001-2 (0.5 USDC), E001-3 (0.25 USDC)
 *   3. pay E001-1 and E001-2 from the client wallet
 *   4. Leave E001-3 pending
 *   5. Print all tx hashes + confirm with eth_getTransactionReceipt
 *
 * Both wallets must have at least 2 USDC (native, 18 decimals) on Arc Testnet.
 * Get testnet USDC from the "Get test USDC" button in Arc Studio sidebar.
 */

import { createWalletClient, createPublicClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcTestnet } from 'viem/chains'
import { HONORARIOS_ABI } from '../src/abi'

const CONTRACT = '0xe4710978da3541cd80468775324aab602e1def28' as const
const RPC = 'https://rpc.testnet.arc.io'
const GAS = { maxFeePerGas: 20_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n }

const freelancerKey = process.env.FREELANCER_KEY as `0x${string}` | undefined
const clientKey = process.env.CLIENT_KEY as `0x${string}` | undefined

if (!freelancerKey || !clientKey) {
  console.error('Set FREELANCER_KEY and CLIENT_KEY env vars.')
  process.exit(1)
}

const freelancer = privateKeyToAccount(freelancerKey)
const client_ = privateKeyToAccount(clientKey)
const chain = arcTestnet

const publicClient = createPublicClient({ chain, transport: http(RPC) })
const freelancerClient = createWalletClient({ account: freelancer, chain, transport: http(RPC) })
const clientClient = createWalletClient({ account: client_, chain, transport: http(RPC) })

async function confirm(hash: `0x${string}`, label: string) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 })
  const ok = receipt.status === 'success' ? '✓' : '✗'
  console.log(`${ok} ${label}: ${hash} (block ${receipt.blockNumber}, status: ${receipt.status})`)
  return receipt
}

async function main() {
  console.log(`Freelancer: ${freelancer.address}`)
  console.log(`Client:     ${client_.address}`)
  console.log(`Contract:   ${CONTRACT}`)
  console.log()

  // 1. setProfile(800, -300)
  const h1 = await freelancerClient.writeContract({
    address: CONTRACT, abi: HONORARIOS_ABI,
    functionName: 'setProfile', args: [800, -300], ...GAS,
  })
  await confirm(h1, 'setProfile(800, -300)')

  // 2. issue E001-1 (1 USDC)
  const h2 = await freelancerClient.writeContract({
    address: CONTRACT, abi: HONORARIOS_ABI,
    functionName: 'issue',
    args: ['E001-1', parseEther('1'), 'Website redesign, October'],
    ...GAS,
  })
  await confirm(h2, 'issue E001-1 (1 USDC)')

  // 3. issue E001-2 (0.5 USDC)
  const h3 = await freelancerClient.writeContract({
    address: CONTRACT, abi: HONORARIOS_ABI,
    functionName: 'issue',
    args: ['E001-2', parseEther('0.5'), 'Content writing, October'],
    ...GAS,
  })
  await confirm(h3, 'issue E001-2 (0.5 USDC)')

  // 4. issue E001-3 (0.25 USDC) — will remain pending
  const h4 = await freelancerClient.writeContract({
    address: CONTRACT, abi: HONORARIOS_ABI,
    functionName: 'issue',
    args: ['E001-3', parseEther('0.25'), 'Logo design'],
    ...GAS,
  })
  await confirm(h4, 'issue E001-3 (0.25 USDC) — pending')

  // 5. pay E001-1
  const h5 = await clientClient.writeContract({
    address: CONTRACT, abi: HONORARIOS_ABI,
    functionName: 'pay', args: [freelancer.address, 'E001-1'],
    value: parseEther('1'), ...GAS,
  })
  await confirm(h5, 'pay E001-1')

  // 6. pay E001-2
  const h6 = await clientClient.writeContract({
    address: CONTRACT, abi: HONORARIOS_ABI,
    functionName: 'pay', args: [freelancer.address, 'E001-2'],
    value: parseEther('0.5'), ...GAS,
  })
  await confirm(h6, 'pay E001-2')

  console.log()
  console.log('Done. Add these to .env:')
  console.log(`VITE_DEMO_FREELANCER=${freelancer.address}`)
  console.log()
  console.log('And add these to src/proof.ts DEMO_TRANSACTIONS:')
  console.log(`  { hash: '${h1}', label: 'setProfile(800, -300)', expect: 'success' },`)
  console.log(`  { hash: '${h5}', label: 'pay E001-1 (1 USDC)', expect: 'success' },`)
  console.log(`  { hash: '${h6}', label: 'pay E001-2 (0.5 USDC)', expect: 'success' },`)
}

main().catch(e => { console.error(e); process.exit(1) })
