/**
 * Typed contract helpers — read from the Honorarios contract
 * using a viem public client with fallback transports and multicall batching.
 *
 * eth_getLogs is chunked (≤9,000 blocks per call) and cached in memory for
 * the session to avoid hammering the RPC on every render.
 */
import { createPublicClient, http, fallback } from 'viem'
import { arcTestnet, arcMainnet } from '../config'
import { HONORARIOS_ABI } from '../abi'
import {
  CONTRACT_ADDRESS,
  CONTRACT_CHAIN_ID,
  CONTRACT_DEPLOY_BLOCK,
  NETWORK,
} from '../deployments'

// ── Public client ─────────────────────────────────────────────────────────────

const testnetTransport = http('https://rpc.testnet.arc.io')
const mainnetTransport = fallback([
  http('https://rpc.mainnet.arc.io'),
  http('https://rpc.drpc.mainnet.arc.io'),
  http('https://rpc.quicknode.mainnet.arc.io'),
  http('https://rpc.blockdaemon.mainnet.arc.io'),
])

const chain = NETWORK === 'testnet' ? arcTestnet : arcMainnet
const transport = NETWORK === 'testnet' ? testnetTransport : mainnetTransport

export const publicClient = createPublicClient({
  chain,
  transport,
  batch: { multicall: { wait: 16 } }, // batch reads with multicall
})

export const contractConfig = {
  address: CONTRACT_ADDRESS as `0x${string}`,
  abi: HONORARIOS_ABI,
  chainId: CONTRACT_CHAIN_ID,
} as const

// ── profileOf tuple decoder (re-exported from side-effect-free module) ────────
export { parseProfileTuple, type ProfileTuple, type Profile } from './profile'

// ── eth_getLogs cache ─────────────────────────────────────────────────────────

const LOG_CHUNK = 9_000n
const logsCache = new Map<string, unknown[]>()

/** Fetch logs for the contract from deploy block to latest, in 9k-block chunks. */
export async function fetchContractLogs(topics: (`0x${string}` | null)[]): Promise<unknown[]> {
  const key = topics.join('|')
  if (logsCache.has(key)) return logsCache.get(key)!

  const head = await publicClient.getBlockNumber()
  const fromBlock = BigInt(CONTRACT_DEPLOY_BLOCK || 0)
  const toBlock = head

  const all: unknown[] = []
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK + 1n) {
    const end = start + LOG_CHUNK > toBlock ? toBlock : start + LOG_CHUNK
    try {
      const chunk = await publicClient.getLogs({
        address: CONTRACT_ADDRESS as `0x${string}`,
        events: undefined,
        fromBlock: start,
        toBlock: end,
      })
      // Filter by topics[0] if given
      const filtered = topics[0]
        ? chunk.filter(l => l.topics[0] === topics[0])
        : chunk
      all.push(...filtered)
    } catch {
      // skip chunk on RPC error, cache what we have
    }
  }

  logsCache.set(key, all)
  return all
}

/** Invalidate a specific topics cache key (call after a write). */
export function invalidateLogsCache(topics: (`0x${string}` | null)[]): void {
  logsCache.delete(topics.join('|'))
}

// ── Receipt helpers ───────────────────────────────────────────────────────────

/** Fetch the list of all receipt refs for a freelancer */
export async function fetchReceiptRefs(freelancer: `0x${string}`): Promise<string[]> {
  const count = (await publicClient.readContract({
    ...contractConfig,
    functionName: 'receiptCount',
    args: [freelancer],
  }))
  if (count === 0n) return []

  // Batch all ref reads in one multicall round-trip
  const calls = Array.from({ length: Number(count) }, (_, i) => ({
    ...contractConfig,
    functionName: 'receiptRefAt' as const,
    args: [freelancer, BigInt(i)] as [`0x${string}`, bigint],
  }))
  const results = await publicClient.multicall({ contracts: calls })
  return results.map(r => (r.status === 'success' ? (r.result) : '')).filter(Boolean)
}

export type ChainReceipt = {
  amount: bigint
  taxBps: number
  utcOffsetMin: number
  issuedAt: number
  paid: boolean
  payer: `0x${string}`
  paidAt: number
  concept: string
  /** Transaction hash of the Paid event (filled by fetchReceiptWithTx) */
  payTxHash?: `0x${string}`
}

export async function fetchReceipt(
  freelancer: `0x${string}`,
  ref: string,
): Promise<ChainReceipt | null> {
  try {
    const raw = await publicClient.readContract({
      ...contractConfig,
      functionName: 'receiptOf',
      args: [freelancer, ref],
    })
    const r = raw as unknown as {
      amount: bigint
      taxBps: number
      utcOffsetMin: number
      issuedAt: bigint
      paid: boolean
      payer: `0x${string}`
      paidAt: bigint
      concept: string
    }
    if (r.issuedAt === 0n) return null
    return {
      amount: r.amount,
      taxBps: Number(r.taxBps),
      utcOffsetMin: Number(r.utcOffsetMin),
      issuedAt: Number(r.issuedAt),
      paid: r.paid,
      payer: r.payer,
      paidAt: Number(r.paidAt),
      concept: r.concept,
    }
  } catch {
    return null
  }
}

/** Fetch all receipts for a freelancer in one multicall batch. */
export async function fetchAllReceipts(
  freelancer: `0x${string}`,
  refs: string[],
): Promise<(ChainReceipt & { ref: string })[]> {
  if (refs.length === 0) return []
  const calls = refs.map(ref => ({
    ...contractConfig,
    functionName: 'receiptOf' as const,
    args: [freelancer, ref] as [`0x${string}`, string],
  }))
  const results = await publicClient.multicall({ contracts: calls })
  return results
    .map((r, i) => {
      if (r.status !== 'success') return null
      const raw = r.result as unknown as {
        amount: bigint
        taxBps: number
        utcOffsetMin: number
        issuedAt: bigint
        paid: boolean
        payer: `0x${string}`
        paidAt: bigint
        concept: string
      }
      if (raw.issuedAt === 0n) return null
      return {
        ref: refs[i],
        amount: raw.amount,
        taxBps: Number(raw.taxBps),
        utcOffsetMin: Number(raw.utcOffsetMin),
        issuedAt: Number(raw.issuedAt),
        paid: raw.paid,
        payer: raw.payer,
        paidAt: Number(raw.paidAt),
        concept: raw.concept,
      }
    })
    .filter((r): r is ChainReceipt & { ref: string } => r !== null)
}

/** 20 gwei minimum to satisfy Arc mempool */
export const MIN_GAS_PRICE = 20_000_000_000n // 20 gwei
