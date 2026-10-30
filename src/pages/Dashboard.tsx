import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useBalance } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { Plus, Copy, Check, DownloadSimple } from '@phosphor-icons/react'
import { Page } from '../components/Layout'
import { Skeleton } from '../components/Skeleton'
import { SplitBar, SplitLegend } from '../components/SplitBar'
import { PeruPanel } from '../components/PeruPanel'
import { HONORARIOS_ABI } from '../abi'
import { CONTRACT_ADDRESS, CONTRACT_CHAIN_ID, NETWORK, IS_DEPLOYED } from '../deployments'
import { useAccountData } from '../hooks/useAccountData'
import { formatDate, shortAddr, parseContractError, fmtUsdc } from '../lib/format'
import { buildShareLink } from '../lib/share'
import { buildMonthCsv, downloadCsv } from '../lib/csv'
import { requireChain } from '../onchain-facts'

function getExplorerBase(): string {
  try { return requireChain(CONTRACT_CHAIN_ID).explorerBase } catch { return '' }
}

function WithdrawReserve({ reserve, onSuccess }: { reserve: bigint; onSuccess: () => Promise<void> }) {
  const { chainId: walletChainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const [amount, setAmount] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [txError, setTxError] = useState<string | null>(null)

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const parsedAmount = (() => {
    try {
      if (!amount) return 0n
      const [w = '0', frac = ''] = amount.split('.')
      return BigInt(w) * 10n ** 18n + BigInt(frac.slice(0, 18).padEnd(18, '0'))
    } catch { return 0n }
  })()

  const setMax = () => setAmount(fmtUsdc(reserve))

  const onWithdraw = () => {
    if (!isConnected || parsedAmount === 0n || parsedAmount > reserve) return
    setTxError(null)
    if (walletChainId !== CONTRACT_CHAIN_ID) { switchChain({ chainId: CONTRACT_CHAIN_ID }); return }
    writeContract(
      {
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: HONORARIOS_ABI,
        functionName: 'withdrawReserve',
        args: [parsedAmount],
        maxFeePerGas: 20_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n,
      },
      {
        onError(e) { setTxError(parseContractError(e)); setConfirmed(false) },
        onSuccess() { void onSuccess(); setAmount(''); setConfirmed(false) },
      },
    )
  }

  if (isSuccess) {
    return <p style={{ color: 'var(--ok)', margin: 0 }}>Withdrawn successfully.</p>
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="wd-amount">Amount (USDC)</label>
          <input
            id="wd-amount"
            type="number"
            min="0.01"
            step="0.01"
            className="mono"
            placeholder="0.00"
            value={amount}
            onChange={e => { setAmount(e.target.value); setConfirmed(false) }}
          />
        </div>
        <button className="btn ghost" style={{ padding: '12px 14px', height: 48 }} onClick={setMax}>Max</button>
      </div>

      {amount && parsedAmount > 0n && !confirmed && (
        <div style={{ padding: '12px 14px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--r)', background: 'var(--surface)', fontSize: 'var(--t-s)', color: 'var(--warn)' }}>
          Withdrawing before your tax month closes can leave you short when the prepayment is due.{' '}
          <button
            className="btn ghost"
            style={{ padding: '6px 10px', fontSize: 'var(--t-xs)', marginTop: 8 }}
            onClick={() => setConfirmed(true)}
          >
            I understand, withdraw anyway
          </button>
        </div>
      )}

      {txError && <p style={{ margin: 0, fontSize: 'var(--t-s)', color: 'var(--warn)' }}>{txError}</p>}

      {confirmed && (
        <button
          className="btn"
          onClick={onWithdraw}
          disabled={isPending || isConfirming || parsedAmount === 0n || parsedAmount > reserve}
        >
          {isPending ? <><span className="spinner" /> Confirm in wallet…</> :
           isConfirming ? <><span className="spinner" /> Withdrawing…</> :
           'Withdraw'}
        </button>
      )}
    </div>
  )
}

/** Derive period label from a period number (year*12 + month-1). */
function periodLabel(period: bigint): string {
  const yr = Number(period) / 12 | 0
  const mo = Number(period) % 12
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[mo]} ${yr}`
}

export function Dashboard() {
  const { address, isConnected } = useAccount()
  const { profile, reserve, pendingNet, monthGross, receipts, loading, error, reload } =
    useAccountData(address)

  const [copiedRef, setCopiedRef] = useState<string | null>(null)
  const [csvBusy, setCsvBusy] = useState(false)

  const { writeContract, data: claimHash, isPending: claimPending } = useWriteContract()
  const { isLoading: claimConfirming, isSuccess: claimSuccess } = useWaitForTransactionReceipt({ hash: claimHash })
  const { switchChain } = useSwitchChain()
  const { chainId: walletChainId } = useAccount()
  const [claimError, setClaimError] = useState<string | null>(null)

  const { data: balData } = useBalance({ address, chainId: CONTRACT_CHAIN_ID })

  const onClaim = () => {
    setClaimError(null)
    if (walletChainId !== CONTRACT_CHAIN_ID) { switchChain({ chainId: CONTRACT_CHAIN_ID }); return }
    writeContract(
      {
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: HONORARIOS_ABI,
        functionName: 'claimNet',
        maxFeePerGas: 20_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n,
      },
      {
        onError(e) { setClaimError(parseContractError(e)) },
        onSuccess() { void reload() },
      },
    )
  }

  const isPeruPreset = profile?.isSet && profile.taxBps === 800 && profile.utcOffsetMin === -300

  const copyPayLink = async (ref: string) => {
    if (!address) return
    const link = await buildShareLink(`#/pay/${address}/${encodeURIComponent(ref)}`)
    void navigator.clipboard.writeText(link).then(() => {
      setCopiedRef(ref)
      setTimeout(() => setCopiedRef(null), 2000)
    })
  }

  const explorerBase = getExplorerBase()

  // ── CSV download ─────────────────────────────────────────────────────────────
  const onDownloadCsv = async () => {
    if (!profile?.isSet || receipts.length === 0) return
    setCsvBusy(true)
    try {
      // Determine current period to label the file
      const { publicClient, contractConfig } = await import('../lib/contract')
      const period = await publicClient.readContract({
        ...contractConfig,
        functionName: 'currentPeriod',
        args: [address!],
      })

      const paidRows = receipts.filter(r => r.paid)
      const csvRows = paidRows.map(r => ({
        ref: r.ref,
        concept: r.concept,
        payer: r.payer,
        paidAt: r.paidAt,
        utcOffsetMin: r.utcOffsetMin,
        grossRaw: r.amount,
        taxBps: r.taxBps,
      }))
      const csv = buildMonthCsv(csvRows, {})
      const label = periodLabel(period)
      downloadCsv(`honorarios-${label.replace(' ', '-').toLowerCase()}.csv`, csv)
    } finally {
      setCsvBusy(false)
    }
  }

  if (!IS_DEPLOYED) {
    return (
      <Page maxWidth={640}>
        <div style={{ display: 'grid', gap: 16, textAlign: 'center', paddingTop: 48 }}>
          <h1 style={{ fontWeight: 600, fontSize: 'var(--t-xl)', margin: 0 }}>Not deployed yet</h1>
          <p style={{ color: 'var(--ink-2)', margin: 0 }}>
            The Honorarios contract has not been deployed to{' '}
            {NETWORK === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet'} yet.
          </p>
        </div>
      </Page>
    )
  }

  if (!isConnected) {
    return (
      <Page maxWidth={640}>
        <div style={{ display: 'grid', gap: 16 }}>
          <h1 style={{ fontWeight: 600, letterSpacing: '-.02em', fontSize: 'var(--t-xl)', margin: 0 }}>Dashboard</h1>
          <p style={{ color: 'var(--ink-2)', margin: 0 }}>Connect your wallet to see your receipts and reserve.</p>
          <ConnectKitButton />
        </div>
      </Page>
    )
  }

  const walletBalance = balData?.value ?? 0n

  return (
    <Page>
      {/* Header */}
      <div className="enter" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 40, flexWrap: 'wrap' }}>
        <div>
          <p className="mono" style={{ margin: '0 0 4px', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
            {address ? shortAddr(address) : ''}
          </p>
          <h1 style={{ fontWeight: 600, letterSpacing: '-.02em', fontSize: 'var(--t-xl)', margin: 0 }}>Your account</h1>
        </div>
        <Link to="/issue" className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} weight="light" /> New receipt
        </Link>
      </div>

      {error && (
        <div className="enter" style={{ marginBottom: 24, padding: '14px 16px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--r)', color: 'var(--warn)', display: 'flex', gap: 12, alignItems: 'center' }}>
          {error}
          <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 'var(--t-xs)' }} onClick={() => { void reload() }}>Retry</button>
        </div>
      )}

      {/* Pending net notice */}
      {!loading && pendingNet > 0n && (
        <div className="enter notice" style={{ marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            A payment could not reach your wallet directly.{' '}
            <span className="mono" style={{ fontWeight: 500 }}>{fmtUsdc(pendingNet)} USDC</span> is waiting to be claimed.
          </div>
          <div>
            {claimError && <p style={{ margin: '0 0 8px', fontSize: 'var(--t-xs)', color: 'var(--warn)' }}>{claimError}</p>}
            {claimSuccess ? (
              <span style={{ color: 'var(--ok)', fontSize: 'var(--t-s)' }}>Claimed</span>
            ) : (
              <button className="btn" style={{ padding: '10px 16px', fontSize: 'var(--t-s)' }} onClick={onClaim} disabled={claimPending || claimConfirming}>
                {claimPending || claimConfirming ? <><span className="spinner" /> Claiming…</> : 'Claim'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hero stats */}
      <div className="hairline-grid enter" style={{ animationDelay: '60ms', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 48 }}>
        <div style={{ padding: '20px 24px' }}>
          <p className="mono" style={{ margin: '0 0 4px', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
            Reserve held
          </p>
          {loading ? <Skeleton height={40} width={130} style={{ marginBottom: 4 }} /> : (
            <span className="mono" style={{ fontSize: 'var(--t-xl)', fontWeight: 500, color: 'var(--accent)' }}>
              {fmtUsdc(reserve)} <span style={{ fontSize: 'var(--t-s)', color: 'var(--ink-3)' }}>USDC</span>
            </span>
          )}
          <p style={{ margin: '4px 0 0', fontSize: 'var(--t-xs)', color: 'var(--ink-3)' }}>Money set aside for your tax prepayment</p>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <p className="mono" style={{ margin: '0 0 4px', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
            Collected this month
          </p>
          {loading ? <Skeleton height={40} width={130} style={{ marginBottom: 4 }} /> : (
            <span className="mono" style={{ fontSize: 'var(--t-xl)', fontWeight: 500 }}>
              {fmtUsdc(monthGross)} <span style={{ fontSize: 'var(--t-s)', color: 'var(--ink-3)' }}>USDC</span>
            </span>
          )}
        </div>
        <div style={{ padding: '20px 24px' }}>
          <p className="mono" style={{ margin: '0 0 4px', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
            Reserve rate
          </p>
          {loading ? <Skeleton height={40} width={80} /> : profile?.isSet ? (
            <>
              <span className="mono" style={{ fontSize: 'var(--t-xl)', fontWeight: 500 }}>
                {(profile.taxBps / 100).toFixed(0)}<span style={{ fontSize: 'var(--t-s)', color: 'var(--ink-3)' }}>%</span>
              </span>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--t-xs)', color: 'var(--ink-3)' }}>Split bar on every receipt</p>
            </>
          ) : (
            <Link to="/setup" className="btn ghost" style={{ marginTop: 4, fontSize: 'var(--t-xs)', padding: '8px 12px' }}>
              Set up profile
            </Link>
          )}
        </div>
        <div style={{ padding: '20px 24px' }}>
          <p className="mono" style={{ margin: '0 0 4px', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
            Payments received
          </p>
          {loading ? <Skeleton height={40} width={60} /> : (
            <span className="mono" style={{ fontSize: 'var(--t-xl)', fontWeight: 500 }}>
              {receipts.filter(r => r.paid).length}
            </span>
          )}
        </div>
      </div>

      {/* Wallet balance notice if low */}
      {walletBalance === 0n && !loading && (
        <div className="enter notice" style={{ marginBottom: 24 }}>
          Your wallet has no USDC on Arc.{' '}
          <a href="https://portal.arc.io/deposit/fiat" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
            Get USDC on Arc
          </a>
        </div>
      )}

      {/* Latest payment split */}
      {!loading && receipts.some(r => r.paid) && (
        <div className="enter" style={{ animationDelay: '120ms', marginBottom: 48 }}>
          {(() => {
            const latest = receipts.find(r => r.paid)!
            return (
              <>
                <p className="mono" style={{ margin: '0 0 10px', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
                  Latest payment · {latest.ref}
                </p>
                <SplitBar taxBps={latest.taxBps} />
                <div style={{ marginTop: 8 }}>
                  <SplitLegend taxBps={latest.taxBps} amount={latest.amount} />
                </div>
              </>
            )
          })()}
        </div>
      )}

      <div className="hairline-grid enter" style={{ animationDelay: '180ms', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', marginBottom: 48 }}>
        {/* Withdraw reserve */}
        <div style={{ padding: '24px' }}>
          <h2 style={{ fontWeight: 600, fontSize: 'var(--t-m)', letterSpacing: '-.015em', margin: '0 0 16px' }}>
            Withdraw reserve
          </h2>
          {loading ? <Skeleton height={48} /> : (
            <WithdrawReserve reserve={reserve} onSuccess={reload} />
          )}
        </div>

        {/* Peru panel */}
        {isPeruPreset && (
          <div style={{ padding: '24px' }}>
            <PeruPanel monthGross18={monthGross} reserve18={reserve} />
          </div>
        )}
      </div>

      {/* Receipts */}
      <div className="enter" style={{ animationDelay: '240ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ fontWeight: 600, fontSize: 'var(--t-m)', letterSpacing: '-.015em', margin: 0 }}>Receipts</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {receipts.some(r => r.paid) && (
              <button
                className="btn ghost"
                style={{ padding: '8px 14px', fontSize: 'var(--t-xs)', display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => { void onDownloadCsv() }}
                disabled={csvBusy}
              >
                {csvBusy ? <span className="spinner" /> : <DownloadSimple size={14} weight="light" />}
                {' '}Download month (CSV)
              </button>
            )}
            <Link to="/issue" className="btn ghost" style={{ padding: '8px 14px', fontSize: 'var(--t-xs)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={14} weight="light" /> New
            </Link>
          </div>
        </div>
        {loading ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {[0,1,2].map(i => <Skeleton key={i} height={52} style={{ animationDelay: `${i*30}ms` }} />)}
          </div>
        ) : receipts.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed var(--rule-strong)', borderRadius: 'var(--r)', color: 'var(--ink-3)' }}>
            <p style={{ margin: '0 0 12px' }}>No receipts yet.</p>
            <Link to="/issue" className="btn">Issue your first receipt</Link>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--rule)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            {receipts.map((r, i) => (
              <div
                key={r.ref}
                className="enter"
                style={{
                  animationDelay: `${Math.min(i, 7) * 30}ms`,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderTop: i > 0 ? '1px solid var(--rule)' : 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p className="mono" style={{ margin: 0, fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.ref}
                  </p>
                  {r.concept && (
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--t-s)', color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.concept}
                    </p>
                  )}
                  {r.paid && r.paidAt > 0 && (
                    <p className="mono" style={{ margin: '2px 0 0', fontSize: 'var(--t-xs)', color: 'var(--ink-3)' }}>
                      Paid {formatDate(r.paidAt)} · from {shortAddr(r.payer)}
                    </p>
                  )}
                </div>
                <span className="mono" style={{ fontSize: 'var(--t-s)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {fmtUsdc(r.amount)} USDC
                </span>
                <span className={`badge ${r.paid ? 'ok' : 'neutral'}`}>{r.paid ? 'Paid' : 'Pending'}</span>
                {!r.paid && address && (
                  <button
                    className="btn ghost"
                    style={{ padding: '6px 10px', fontSize: 'var(--t-xs)' }}
                    onClick={() => { void copyPayLink(r.ref) }}
                    aria-label="Copy payment link"
                  >
                    {copiedRef === r.ref ? <Check size={14} weight="light" /> : <Copy size={14} weight="light" />}
                  </button>
                )}
                {r.paid && explorerBase && (
                  <a
                    href={`${explorerBase}/address/${r.payer}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn ghost"
                    style={{ padding: '6px 10px', fontSize: 'var(--t-xs)' }}
                    title="View payer on explorer"
                  >
                    ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  )
}
