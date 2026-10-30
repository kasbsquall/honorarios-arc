/**
 * Unit tests for parseNetSentFromLogs.
 *
 * Builds real ABI-encoded log fixtures using viem so the encoding is identical
 * to what the EVM emits. The Paid event has a dynamic `string ref` as the first
 * non-indexed field, which shifts every subsequent word — this is the exact bug
 * that hand-rolling word offsets misses.
 */
import { describe, it, expect } from 'vitest'
import {
  encodeEventTopics,
  encodeAbiParameters,
  keccak256,
  toHex,
  toBytes,
  pad,
} from 'viem'
import { HONORARIOS_ABI } from '../abi'
import { parseNetSentFromLogs, type MinimalLog } from './parse-paid-log'

const CONTRACT = '0xE4710978Da3541Cd80468775324aaB602E1dEF28' as const
const FREELANCER = '0x1111111111111111111111111111111111111111' as const
const PAYER = '0x2222222222222222222222222222222222222222' as const

/** Build a minimal Log-shaped object for a Paid event. */
function makePaidLog(ref: string, netSent: boolean): MinimalLog {
  // topics: [sig, freelancer (indexed), refHash (indexed), payer (indexed)]
  const refHash = keccak256(toHex(toBytes(ref)))
  const topics = encodeEventTopics({
    abi: HONORARIOS_ABI,
    eventName: 'Paid',
    args: { freelancer: FREELANCER, refHash, payer: PAYER },
  }) as [`0x${string}`, ...`0x${string}`[]]

  // Non-indexed fields (in ABI order): ref (string), amount, net, reserve, period, netSent
  const data = encodeAbiParameters(
    [
      { name: 'ref', type: 'string' },
      { name: 'amount', type: 'uint256' },
      { name: 'net', type: 'uint256' },
      { name: 'reserve', type: 'uint256' },
      { name: 'period', type: 'uint256' },
      { name: 'netSent', type: 'bool' },
    ],
    [
      ref,
      500_000_000_000_000_000n, // 0.5 USDC (18 dec)
      460_000_000_000_000_000n, // 0.46 USDC net
       40_000_000_000_000_000n, // 0.04 USDC reserve
      202601n,                  // arbitrary period
      netSent,
    ],
  )

  return {
    address: CONTRACT,
    topics,
    data,
    blockHash: pad('0xaa', { size: 32 }),
    blockNumber: 1n,
    logIndex: 0,
    removed: false,
    transactionHash: pad('0xbb', { size: 32 }),
    transactionIndex: 0,
  }
}

/** Build a minimal NetDeferred log. */
function makeNetDeferredLog(ref: string): MinimalLog {
  const refHash = keccak256(toHex(toBytes(ref)))
  const topics = encodeEventTopics({
    abi: HONORARIOS_ABI,
    eventName: 'NetDeferred',
    args: { freelancer: FREELANCER, refHash },
  }) as [`0x${string}`, ...`0x${string}`[]]

  const data = encodeAbiParameters(
    [{ name: 'net', type: 'uint256' }],
    [460_000_000_000_000_000n],
  )

  return {
    address: CONTRACT,
    topics,
    data,
    blockHash: pad('0xaa', { size: 32 }),
    blockNumber: 1n,
    logIndex: 1,
    removed: false,
    transactionHash: pad('0xbb', { size: 32 }),
    transactionIndex: 0,
  }
}

describe('parseNetSentFromLogs', () => {
  it('returns true when Paid.netSent = true, ref = "E001-1"', () => {
    const log = makePaidLog('E001-1', true)
    expect(parseNetSentFromLogs([log], CONTRACT)).toBe(true)
  })

  it('returns false when Paid.netSent = false, ref = "E001-1"', () => {
    const log = makePaidLog('E001-1', false)
    expect(parseNetSentFromLogs([log], CONTRACT)).toBe(false)
  })

  it('returns false when NetDeferred is present (even if Paid.netSent = true)', () => {
    // Contract emits Paid(netSent=false) + NetDeferred; the deferred log is definitive
    const paidLog = makePaidLog('E001-1', false)
    const deferredLog = makeNetDeferredLog('E001-1')
    expect(parseNetSentFromLogs([paidLog, deferredLog], CONTRACT)).toBe(false)
  })

  it('returns null when no logs match the contract address', () => {
    const otherContract = '0x9999999999999999999999999999999999999999' as const
    const log = makePaidLog('E001-1', true)
    expect(parseNetSentFromLogs([log], otherContract)).toBeNull()
  })

  it('returns null when the logs array is empty', () => {
    expect(parseNetSentFromLogs([], CONTRACT)).toBeNull()
  })

  it('works with a multi-character ref "E001-2" (ref byte length != 6)', () => {
    const log = makePaidLog('E001-2', true)
    expect(parseNetSentFromLogs([log], CONTRACT)).toBe(true)
  })

  it('ignores logs from a different address', () => {
    const foreignLog = { ...makePaidLog('E001-1', true), address: '0x9999999999999999999999999999999999999999' as `0x${string}` }
    const realLog = makePaidLog('E001-1', false)
    // Only the real contract log should be decoded
    expect(parseNetSentFromLogs([foreignLog, realLog], CONTRACT)).toBe(false)
  })
})
