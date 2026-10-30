/**
 * Loads all on-chain data for a given freelancer address:
 * profile, reserve, pendingNet, all receipts, and this month's gross.
 * Uses multicall batching to minimise RPC round-trips.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  publicClient,
  fetchReceiptRefs,
  fetchAllReceipts,
  contractConfig,
  parseProfileTuple,
  type ChainReceipt,
} from '../lib/contract'

export interface ReceiptRow extends ChainReceipt {
  ref: string
}

export interface AccountData {
  profile: { taxBps: number; utcOffsetMin: number; isSet: boolean } | null
  reserve: bigint
  pendingNet: bigint
  monthGross: bigint
  receipts: ReceiptRow[]
  loading: boolean
  error: string | null
  // eslint-disable-next-line typescript/no-misused-promises
  reload: () => Promise<void>
}

export function useAccountData(freelancer: `0x${string}` | undefined): AccountData {
  const [data, setData] = useState<Omit<AccountData, 'reload'>>({
    profile: null,
    reserve: 0n,
    pendingNet: 0n,
    monthGross: 0n,
    receipts: [],
    loading: true,
    error: null,
  })

  const load = useCallback(async () => {
    if (!freelancer) {
      setData({ profile: null, reserve: 0n, pendingNet: 0n, monthGross: 0n, receipts: [], loading: false, error: null })
      return
    }
    setData(d => ({ ...d, loading: true, error: null }))
    try {
      // Batch: profile + reserve + pendingNet in one multicall
      const [profileRes, reserveRes, pendingNetRes] = await publicClient.multicall({
        contracts: [
          { ...contractConfig, functionName: 'profileOf', args: [freelancer] },
          { ...contractConfig, functionName: 'reserveOf', args: [freelancer] },
          { ...contractConfig, functionName: 'pendingNet', args: [freelancer] },
        ],
      })

      const profile = profileRes.status === 'success'
        ? parseProfileTuple(profileRes.result)
        : null
      const reserve = reserveRes.status === 'success' ? (reserveRes.result) : 0n
      const pendingNet = pendingNetRes.status === 'success' ? (pendingNetRes.result) : 0n

      // Fetch current period + month gross (only if profile set)
      let monthGross = 0n
      if (profile?.isSet) {
        try {
          const period = await publicClient.readContract({
            ...contractConfig,
            functionName: 'currentPeriod',
            args: [freelancer],
          })
          monthGross = await publicClient.readContract({
            ...contractConfig,
            functionName: 'monthGross',
            args: [freelancer, period],
          })
        } catch { /* no-op: profile may be set but no payments yet */ }
      }

      // Fetch all receipts in two batched calls
      const refs = await fetchReceiptRefs(freelancer)
      const receiptRows = await fetchAllReceipts(freelancer, refs)
      receiptRows.sort((a, b) => b.issuedAt - a.issuedAt)

      setData({ profile, reserve, pendingNet, monthGross, receipts: receiptRows, loading: false, error: null })
    } catch {
      setData(d => ({ ...d, loading: false, error: 'Could not load data. The RPC may be unavailable.' }))
    }
  }, [freelancer])

  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => { void load() }, [load])

  return { ...data, reload: load }
}
