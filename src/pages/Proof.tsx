/**
 * /proof — public proof-of-work page.
 * Readable with no wallet. Shows contract counters, all receipts, and demo tx verification.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, X, ArrowSquareOut } from '@phosphor-icons/react'
import { Page } from '../components/Layout'
import { Skeleton } from '../components/Skeleton'
import {
  publicClient,
  contractConfig,
  fetchReceiptRefs,
  fetchAllReceipts,
  type ChainReceipt,
} from '../lib/contract'
import {
  CONTRACT_ADDRESS,
  CONTRACT_CHAIN_ID,
  DEMO_FREELANCER,
  IS_DEPLOYED,
  NETWORK,
} from '../deployments'
import { formatDate, shortAddr, fmtUsdc, ceilReserve } from '../lib/format'
import { requireChain } from '../onchain-facts'
import { DEMO_TRANSACTIONS, type DemoTx } from '../proof'

function getExplorerBase(): string {
  try { return requireChain(CONTRACT_CHAIN_ID).explorerBase } catch { return '' }
}

interface TxResult {
  tx: DemoTx
  actual: 'success' | 'reverted' | 'not found' | 'loading'
}

interface ProofData {
  issuedCount: number
  paidCount: number
  totalPaid: bigint
  reserveOf: bigint
  totalLiabilities: bigint
  receipts: (ChainReceipt & { ref: string })[]
  loading: boolean
  error: string | null
}

export function Proof() {
  const [params] = useSearchParams()
  const explorerBase = getExplorerBase()

  // Freelancer address: ?f=0x... or fall back to DEMO_FREELANCER
  const rawF = params.get('f')
  const freelancer: `0x${string}` | undefined =
    rawF && /^0x[0-9a-fA-F]{40}$/.test(rawF)
      ? (rawF as `0x${string}`)
      : DEMO_FREELANCER !== '0x0000000000000000000000000000000000000000'
        ? DEMO_FREELANCER
        : undefined

  const [data, setData] = useState<ProofData>({
    issuedCount: 0, paidCount: 0, totalPaid: 0n, reserveOf: 0n, totalLiabilities: 0n,
    receipts: [], loading: true, error: null,
  })
  const [demoResults, setDemoResults] = useState<TxResult[]>(
    DEMO_TRANSACTIONS.map(tx => ({ tx, actual: 'loading' }))
  )

  useEffect(() => {
    if (!IS_DEPLOYED || !freelancer) {
      void Promise.resolve().then(() => setData(d => ({ ...d, loading: false }))); return
    }

    async function load() {
      try {
        // Batch: reserveOf + totalLiabilities
        const [reserveRes, liabRes] = await publicClient.multicall({
          contracts: [
            { ...contractConfig, functionName: 'reserveOf', args: [freelancer!] },
            { ...contractConfig, functionName: 'totalLiabilities' },
          ],
        })
        const reserveOf = reserveRes.status === 'success' ? (reserveRes.result) : 0n
        const totalLiabilities = liabRes.status === 'success' ? (liabRes.result) : 0n

        const refs = await fetchReceiptRefs(freelancer!)
        const receipts = await fetchAllReceipts(freelancer!, refs)
        receipts.sort((a, b) => b.issuedAt - a.issuedAt)

        const paidReceipts = receipts.filter(r => r.paid)
        const totalPaid = paidReceipts.reduce((acc, r) => acc + r.amount, 0n)

        setData({
          issuedCount: receipts.length,
          paidCount: paidReceipts.length,
          totalPaid,
          reserveOf,
          totalLiabilities,
          receipts,
          loading: false,
          error: null,
        })
      } catch {
        setData(d => ({ ...d, loading: false, error: 'Could not load proof data. Check your connection.' }))
      }
    }
    void load()
  }, [freelancer])

  // Verify demo transactions — each fetch runs independently after mount
  useEffect(() => {
    if (DEMO_TRANSACTIONS.length === 0) return
    DEMO_TRANSACTIONS.forEach((tx, idx) => {
      void publicClient.getTransactionReceipt({ hash: tx.hash })
        .then(receipt => {
          const actual: 'success' | 'reverted' = receipt.status === 'success' ? 'success' : 'reverted'
          setDemoResults(prev => { const n = [...prev]; n[idx] = { tx, actual }; return n })
        })
        .catch(() => {
          setDemoResults(prev => { const n = [...prev]; n[idx] = { tx, actual: 'not found' }; return n })
        })
    })
  }, [])

  if (!IS_DEPLOYED) {
    return (
      <Page maxWidth={800}>
        <div style={{ paddingTop: 48, textAlign: 'center', display: 'grid', gap: 12 }}>
          <h1 style={{ fontWeight: 600, fontSize: 'var(--t-xl)', margin: 0 }}>Not deployed yet</h1>
          <p style={{ color: 'var(--ink-2)', margin: 0 }}>
            The Honorarios contract is not live on {NETWORK === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet'} yet.
          </p>
        </div>
      </Page>
    )
  }

  if (!freelancer) {
    return (
      <Page maxWidth={800}>
        <div style={{ paddingTop: 48, display: 'grid', gap: 12 }}>
          <h1 style={{ fontWeight: 600, fontSize: 'var(--t-xl)', margin: 0 }}>Proof of work</h1>
          <p style={{ color: 'var(--ink-2)', margin: 0 }}>
            Pass <code className="mono">?f=0x…</code> in the URL to verify a specific address.
          </p>
        </div>
      </Page>
    )
  }

  const { issuedCount, paidCount, totalPaid, reserveOf, totalLiabilities, receipts, loading, error } = data

  return (
    <Page maxWidth={800}>
      <div className="enter" style={{ marginBottom: 40 }}>
        <h1 style={{ fontWeight: 600, letterSpacing: '-.02em', fontSize: 'var(--t-xl)', margin: '0 0 8px' }}>
          Proof of work
        </h1>
        <p className="mono" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-3)', margin: 0, wordBreak: 'break-all' }}>
          {freelancer}
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: 24, padding: '14px 16px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--r)', color: 'var(--warn)' }}>
          {error}
        </div>
      )}

      {/* Counters — exactly 5 cells, one row on desktop, wrapping on small screens */}
      <div
        className="hairline-grid counters-5 enter"
        style={{ animationDelay: '60ms', marginBottom: 48 }}
      >
        {[
          { label: 'Receipts issued', value: loading ? null : String(issuedCount) },
          { label: 'Receipts paid', value: loading ? null : String(paidCount) },
          { label: 'USDC paid', value: loading ? null : `${fmtUsdc(totalPaid)} USDC` },
          { label: 'In reserve', value: loading ? null : `${fmtUsdc(reserveOf)} USDC` },
          { label: 'Total liabilities', value: loading ? null : `${fmtUsdc(totalLiabilities)} USDC` },
        ].map(({ label, value }) => (
          <div key={label} style={{ padding: '20px 16px' }}>
            <p className="mono" style={{ margin: '0 0 6px', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label}
            </p>
            {value === null
              ? <Skeleton height={32} width={64} />
              : <span className="mono" style={{ fontSize: 'var(--t-l)', fontWeight: 500 }}>{value}</span>
            }
          </div>
        ))}
      </div>

      {/* Receipt table */}
      <div className="enter" style={{ animationDelay: '120ms', marginBottom: 48 }}>
        <h2 style={{ fontWeight: 600, fontSize: 'var(--t-m)', letterSpacing: '-.015em', margin: '0 0 16px' }}>
          All receipts
        </h2>
        {loading ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {[0,1,2].map(i => <Skeleton key={i} height={52} />)}
          </div>
        ) : receipts.length === 0 ? (
          <p style={{ color: 'var(--ink-3)', fontSize: 'var(--t-s)' }}>No receipts found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-s)' }}>
              <thead>
                <tr>
                  {['Ref', 'Status', 'Amount', 'Reserve', 'Net', 'Payer', 'Paid on', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid var(--rule-strong)', color: 'var(--ink-3)', fontFamily: 'var(--f-mono)', fontWeight: 400, fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => {
                  const reserve = ceilReserve(r.amount, r.taxBps)
                  const net = r.amount - reserve
                  return (
                    <tr key={r.ref} style={{ borderBottom: '1px solid var(--rule)' }}>
                      <td style={{ padding: '12px', fontFamily: 'var(--f-mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{r.ref}</td>
                      <td style={{ padding: '12px' }}>
                        <span className={`badge ${r.paid ? 'ok' : 'neutral'}`}>{r.paid ? 'Paid' : 'Pending'}</span>
                      </td>
                      <td className="mono" style={{ padding: '12px', whiteSpace: 'nowrap' }}>{fmtUsdc(r.amount)}</td>
                      <td className="mono" style={{ padding: '12px', whiteSpace: 'nowrap', color: 'var(--accent)' }}>{fmtUsdc(reserve)}</td>
                      <td className="mono" style={{ padding: '12px', whiteSpace: 'nowrap' }}>{fmtUsdc(net)}</td>
                      <td className="mono" style={{ padding: '12px', fontSize: 'var(--t-xs)', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                        {r.paid ? shortAddr(r.payer) : '—'}
                      </td>
                      <td className="mono" style={{ padding: '12px', fontSize: 'var(--t-xs)', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                        {r.paid && r.paidAt > 0 ? formatDate(r.paidAt) : '—'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {r.paid && explorerBase && (
                          <a
                            href={`${explorerBase}/address/${r.payer}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--ink-3)' }}
                            title="View payer on explorer"
                          >
                            <ArrowSquareOut size={14} weight="light" />
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Demo transactions */}
      {DEMO_TRANSACTIONS.length > 0 && (
        <div className="enter" style={{ animationDelay: '180ms', marginBottom: 48 }}>
          <h2 style={{ fontWeight: 600, fontSize: 'var(--t-m)', letterSpacing: '-.015em', margin: '0 0 16px' }}>
            Demonstrations
          </h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {demoResults.map(({ tx, actual }, i) => {
              const matches = actual === tx.expect
              return (
                <div
                  key={i}
                  style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 12, alignItems: 'center', padding: '14px 16px', border: '1px solid var(--rule)', borderRadius: 'var(--r)' }}
                >
                  <span style={{ color: matches ? 'var(--ok)' : 'var(--warn)' }}>
                    {actual === 'loading' ? <span className="spinner" /> :
                     matches ? <Check size={16} weight="bold" /> : <X size={16} weight="bold" />}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontSize: 'var(--t-s)' }}>{tx.label}</p>
                    <p className="mono" style={{ margin: '2px 0 0', fontSize: 'var(--t-xs)', color: 'var(--ink-3)' }}>
                      Expected: {tx.expect} · Actual: {actual}
                    </p>
                  </div>
                  <span className={`badge ${actual === 'success' ? 'ok' : actual === 'reverted' ? 'warn' : 'neutral'}`}>
                    {actual === 'loading' ? '…' : actual}
                  </span>
                  {explorerBase && (
                    <a
                      href={`${explorerBase}/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono"
                      style={{ color: 'var(--ink-3)', fontSize: 'var(--t-xs)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                      title={tx.hash}
                    >
                      {tx.hash.slice(0, 6)}&hellip;{tx.hash.slice(-4)}
                      <ArrowSquareOut size={12} weight="light" />
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* How to verify */}
      <div className="enter" style={{ animationDelay: '240ms', marginBottom: 48 }}>
        <h2 style={{ fontWeight: 600, fontSize: 'var(--t-m)', letterSpacing: '-.015em', margin: '0 0 12px' }}>
          How to verify
        </h2>
        <p style={{ color: 'var(--ink-2)', lineHeight: 1.65, fontSize: 'var(--t-s)', margin: '0 0 12px' }}>
          Every number on this page is read in real time from the contract at{' '}
          <a
            href={explorerBase ? `${explorerBase}/address/${CONTRACT_ADDRESS}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="mono"
            style={{ color: 'var(--accent)', fontSize: 'var(--t-xs)', wordBreak: 'break-all' }}
          >
            {CONTRACT_ADDRESS}
          </a>{' '}
          on {NETWORK === 'testnet' ? 'Arc Testnet' : 'Arc Mainnet'}.
          The contract source code is open and verified. Any blockchain explorer can confirm each transaction hash independently.
        </p>
        <p style={{ color: 'var(--ink-3)', fontSize: 'var(--t-xs)', lineHeight: 1.65, margin: 0 }}>
          To verify a specific address, append <code className="mono" style={{ background: 'var(--sunk)', padding: '1px 4px', borderRadius: 'var(--r)' }}>?f=0x…</code> to this page's URL.
        </p>
      </div>
    </Page>
  )
}
