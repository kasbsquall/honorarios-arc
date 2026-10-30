/**
 * Decode the `Paid` and `NetDeferred` events from a transaction receipt's logs
 * using viem's `parseEventLogs` so the ABI handles the dynamic `string ref`
 * field correctly — hand-rolling word offsets is incorrect when a dynamic type
 * precedes `netSent` in the non-indexed data.
 *
 * Returns:
 *   true  — net was sent to the freelancer in the same tx (netSent = true)
 *   false — net was deferred (netSent = false, or a NetDeferred log present)
 *   null  — no Paid log found for this contract address (caller should default to true)
 */
import { parseEventLogs, type Log } from 'viem'
import { HONORARIOS_ABI } from '../abi'

export type MinimalLog = Pick<Log, 'address' | 'topics' | 'data' | 'blockHash' | 'blockNumber' | 'logIndex' | 'removed' | 'transactionHash' | 'transactionIndex'>

export function parseNetSentFromLogs(
  logs: MinimalLog[],
  contractAddress: `0x${string}`,
): boolean | null {
  const addr = contractAddress.toLowerCase()

  // Filter to logs from the contract so parseEventLogs never sees foreign events
  const contractLogs = logs.filter(l => l.address.toLowerCase() === addr)
  if (contractLogs.length === 0) return null

  // Decode all Paid and NetDeferred events in one pass
  const decoded = parseEventLogs({
    abi: HONORARIOS_ABI,
    logs: contractLogs,
    eventName: ['Paid', 'NetDeferred'],
    strict: false, // skip logs that fail to decode rather than throwing
  })

  // A NetDeferred log in the same tx is definitive proof the push failed
  const hasDeferred = decoded.some(e => e.eventName === 'NetDeferred')
  if (hasDeferred) return false

  const paidLog = decoded.find(e => e.eventName === 'Paid')
  if (!paidLog) return null

  // paidLog.args is strongly typed by viem from the ABI
  const args = paidLog.args as { netSent?: boolean }
  return args.netSent === true
}
