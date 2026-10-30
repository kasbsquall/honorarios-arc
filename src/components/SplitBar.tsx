import { useEffect, useRef, useState } from 'react'
import { fmtUsdc, ceilReserve } from '../lib/format'

interface SplitBarProps {
  /** Tax rate in basis points (0–5000) */
  taxBps: number
  animated?: boolean
}

export function SplitBar({ taxBps, animated = true }: SplitBarProps) {
  const [ready, setReady] = useState(!animated)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!animated) return
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [animated])

  const netFlex = 100 - taxBps / 100
  const resFlex = taxBps / 100

  return (
    <div ref={ref} className="split-bar" style={{ marginTop: 4 }}>
      <div
        className="net-seg"
        style={{
          flex: netFlex,
          transform: ready ? 'scaleX(1)' : 'scaleX(0)',
          transition: animated ? `transform 420ms var(--ease)` : 'none',
        }}
      />
      <div
        className="reserve-seg"
        style={{
          flex: resFlex,
          transform: ready ? 'scaleX(1)' : 'scaleX(0)',
          transition: animated ? `transform 420ms var(--ease) 70ms` : 'none',
        }}
      />
    </div>
  )
}

interface SplitLegendProps {
  taxBps: number
  amount: bigint
  /** If true, show amounts */
  showAmounts?: boolean
}

export function SplitLegend({ taxBps, amount, showAmounts = true }: SplitLegendProps) {
  const reserveRaw = ceilReserve(amount, taxBps)
  const netRaw = amount - reserveRaw
  const netPct = 100 - taxBps / 100
  const resPct = taxBps / 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* To wallet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, background: 'var(--ink)', borderRadius: 1, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 'var(--t-s)', color: 'var(--ink-2)' }}>
          To your wallet <span className="mono" style={{ color: 'var(--ink-3)' }}>{netPct.toFixed(netPct % 1 === 0 ? 0 : 1)}%</span>
        </span>
        {showAmounts && (
          <span className="mono" style={{ fontSize: 'var(--t-s)', fontWeight: 500 }}>
            {fmtUsdc(netRaw)} USDC
          </span>
        )}
      </div>
      {/* Reserve */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, background: 'var(--accent)', borderRadius: 1, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 'var(--t-s)', color: 'var(--ink-2)' }}>
          Tax reserve (money set aside for your tax prepayment){' '}
          <span className="mono" style={{ color: 'var(--ink-3)' }}>{resPct.toFixed(resPct % 1 === 0 ? 0 : 1)}%</span>
        </span>
        {showAmounts && (
          <span className="mono" style={{ fontSize: 'var(--t-s)', fontWeight: 500, color: 'var(--accent)' }}>
            {fmtUsdc(reserveRaw)} USDC
          </span>
        )}
      </div>
    </div>
  )
}
