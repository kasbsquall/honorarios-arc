import { Eye } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Page } from '../components/Layout'
import { Skeleton } from '../components/Skeleton'
import { SplitBar, SplitLegend } from '../components/SplitBar'
import { PeruPanel } from '../components/PeruPanel'
import { useAccountData } from '../hooks/useAccountData'
import { DEMO_FREELANCER, NETWORK } from '../deployments'
import { formatDate, shortAddr } from '../lib/format'
import { requireChain } from '../onchain-facts'

const chainId = NETWORK === 'testnet' ? 5042002 : 5042
const explorerBase = (() => { try { return requireChain(chainId).explorerBase } catch { return '' } })()

export function Home() {
  const { profile, reserve, pendingNet: _pNet, monthGross, receipts, loading, error, reload } =
    useAccountData(DEMO_FREELANCER !== '0x0000000000000000000000000000000000000000' ? DEMO_FREELANCER : undefined)

  // Latest paid receipt for the hero split
  const latestPaid = receipts.find(r => r.paid)

  const isPeruPreset = profile?.isSet && profile.taxBps === 800 && profile.utcOffsetMin === -300

  const fmtUsdc = (v: bigint) => {
    const w = v / 10n ** 18n
    const f = (v % 10n ** 18n) / 10n ** 16n
    return `${w}.${String(f).padStart(2, '0')}`
  }

  if (DEMO_FREELANCER === '0x0000000000000000000000000000000000000000') {
    return (
      <Page>
        <div style={{ maxWidth: 560, marginTop: 48 }}>
          <h1 style={{ fontWeight: 600, letterSpacing: '-.02em', fontSize: 'var(--t-xl)' }}>
            Tax reserves for freelancers paid abroad
          </h1>
          <p style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}>
            When a foreign client pays you in full, Honorarios sets aside the tax prepayment at the moment the payment arrives — so you are never caught short at month end.
          </p>
          <Link to="/setup" className="btn" style={{ marginTop: 24 }}>
            Get started
          </Link>
        </div>
      </Page>
    )
  }

  return (
    <Page>
      {/* Read-only notice */}
      <div className="notice enter" style={{ marginBottom: 32, animationDelay: '0ms' }}>
        <Eye size={18} weight="light" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Sample account — read only.{' '}
          {explorerBase && (
            <a
              href={`${explorerBase}/address/${DEMO_FREELANCER}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--ink-2)' }}
            >
              View on explorer
            </a>
          )}
          {' · '}
          <Link to="/setup" style={{ color: 'var(--ink-2)' }}>Connect your own wallet</Link>
        </span>
      </div>

      {error && (
        <div style={{ marginBottom: 24, padding: '14px 16px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--r)', color: 'var(--warn)' }} className="enter">
          {error}{' '}
          <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 'var(--t-xs)' }} onClick={() => { void reload() }}>
            Retry
          </button>
        </div>
      )}

      {/* Hero split from latest paid receipt */}
      {loading ? (
        <div className="enter" style={{ animationDelay: '60ms', marginBottom: 48 }}>
          <Skeleton height={120} />
        </div>
      ) : latestPaid ? (
        <div className="enter" style={{ animationDelay: '60ms', marginBottom: 48 }}>
          <p className="mono" style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', margin: '0 0 12px' }}>
            Latest payment
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: 'clamp(2.4rem, 1.5rem + 4vw, 4rem)', fontWeight: 500, lineHeight: .88, letterSpacing: '-.05em' }}>
              {fmtUsdc(latestPaid.amount)}
            </span>
            <span className="mono" style={{ fontSize: 'var(--t-s)', color: 'var(--ink-3)' }}>USDC paid</span>
          </div>
          <SplitBar taxBps={latestPaid.taxBps} />
          <div style={{ marginTop: 8 }}>
            <SplitLegend taxBps={latestPaid.taxBps} amount={latestPaid.amount} />
          </div>
        </div>
      ) : null}

      {/* Stats grid */}
      <div className="hairline-grid enter" style={{ animationDelay: '120ms', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 48 }}>
        {/* This month's collected */}
        <div style={{ padding: '20px 24px' }}>
          <p className="mono" style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', margin: '0 0 8px' }}>
            Collected this month
          </p>
          {loading ? <Skeleton height={36} width={120} /> : (
            <span className="mono" style={{ fontSize: 'var(--t-xl)', fontWeight: 500 }}>
              {fmtUsdc(monthGross)} <span style={{ fontSize: 'var(--t-s)', color: 'var(--ink-3)' }}>USDC</span>
            </span>
          )}
        </div>
        {/* Reserve */}
        <div style={{ padding: '20px 24px' }}>
          <p className="mono" style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', margin: '0 0 8px' }}>
            Reserve held
          </p>
          {loading ? <Skeleton height={36} width={120} /> : (
            <span className="mono" style={{ fontSize: 'var(--t-xl)', fontWeight: 500, color: 'var(--accent)' }}>
              {fmtUsdc(reserve)} <span style={{ fontSize: 'var(--t-s)', color: 'var(--ink-3)' }}>USDC</span>
            </span>
          )}
          <p style={{ margin: '4px 0 0', fontSize: 'var(--t-xs)', color: 'var(--ink-3)' }}>
            Money set aside for your tax prepayment
          </p>
        </div>
        {/* Reserve rate */}
        <div style={{ padding: '20px 24px' }}>
          <p className="mono" style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', margin: '0 0 8px' }}>
            Reserve rate
          </p>
          {loading ? <Skeleton height={36} width={80} /> : profile?.isSet ? (
            <span className="mono" style={{ fontSize: 'var(--t-xl)', fontWeight: 500 }}>
              {(profile.taxBps / 100).toFixed(0)}<span style={{ fontSize: 'var(--t-s)', color: 'var(--ink-3)' }}>%</span>
            </span>
          ) : (
            <span style={{ fontSize: 'var(--t-s)', color: 'var(--ink-3)' }}>No profile set</span>
          )}
        </div>
      </div>

      {/* Peru panel */}
      {isPeruPreset && !loading && (
        <div className="enter" style={{ animationDelay: '180ms', border: '1px solid var(--rule-strong)', borderRadius: 'var(--r)', padding: '24px', marginBottom: 48 }}>
          <PeruPanel monthGross18={monthGross} reserve18={reserve} />
        </div>
      )}

      {/* Receipts list */}
      <div className="enter" style={{ animationDelay: '240ms' }}>
        <h2 style={{ fontWeight: 600, fontSize: 'var(--t-m)', letterSpacing: '-.015em', margin: '0 0 16px' }}>
          Receipts
        </h2>
        {loading ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {[0,1,2].map(i => <Skeleton key={i} height={52} style={{ animationDelay: `${i*30}ms` }} />)}
          </div>
        ) : receipts.length === 0 ? (
          <p style={{ color: 'var(--ink-3)', fontSize: 'var(--t-s)', margin: 0 }}>No receipts issued yet.</p>
        ) : (
          <div style={{ border: '1px solid var(--rule)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            {receipts.map((r, i) => {
              const payLink = `/pay/${DEMO_FREELANCER}/${encodeURIComponent(r.ref)}`
              return (
                <div
                  key={r.ref}
                  className="enter"
                  style={{
                    animationDelay: `${Math.min(i, 7) * 30}ms`,
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: 16,
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
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`badge ${r.paid ? 'ok' : 'neutral'}`}>{r.paid ? 'Paid' : 'Pending'}</span>
                    {!r.paid && (
                      <Link to={payLink} className="btn ghost" style={{ padding: '6px 10px', fontSize: 'var(--t-xs)' }}>
                        Payment link
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Page>
  )
}
