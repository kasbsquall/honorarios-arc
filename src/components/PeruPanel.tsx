import { useState } from 'react'
import {
  calcPeruTax,
  PERU_THRESHOLD_SOLES,
  PERU_THRESHOLD_SOURCE,
  PERU_THRESHOLD_URL,
} from '../tax/peru'

interface PeruPanelProps {
  monthGross18: bigint   // this month's gross, 18-decimal
  reserve18: bigint      // reserve held, 18-decimal
}

export function PeruPanel({ monthGross18, reserve18 }: PeruPanelProps) {
  const [rate, setRate] = useState('')
  const [otherIncome, setOtherIncome] = useState('')
  const [otherConfirmed, setOtherConfirmed] = useState(false)

  const exchangeRate = parseFloat(rate) || undefined
  const otherSoles = otherConfirmed ? (parseFloat(otherIncome) || 0) : 0

  const result = calcPeruTax({
    grossUsdc18: monthGross18,
    exchangeRatePenPerUsd: exchangeRate,
    otherIncomeSoles: otherSoles,
    reserveUsdc18: reserve18,
  })

  const thresholdPct = result.error
    ? 0
    : Math.min((result.grossSoles / PERU_THRESHOLD_SOLES) * 100, 100)

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="mono" style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
          Tax reserve · 8% on new receipts
        </span>
        <span className="badge accent">Peru</span>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <div className="field">
          <label htmlFor="exchange-rate">Exchange rate (PEN per USD)</label>
          <input
            id="exchange-rate"
            type="number"
            min="0"
            step="0.01"
            className="mono"
            placeholder="e.g. 3.80"
            value={rate}
            onChange={e => setRate(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="other-income">Other fourth-category income this month (S/)</label>
          <input
            id="other-income"
            type="number"
            min="0"
            step="1"
            className="mono"
            placeholder="Leave empty if none"
            value={otherIncome}
            onChange={e => { setOtherIncome(e.target.value); setOtherConfirmed(false) }}
          />
          {otherIncome && !otherConfirmed && (
            <button
              className="btn ghost"
              style={{ alignSelf: 'flex-start', fontSize: 'var(--t-xs)', padding: '8px 12px' }}
              onClick={() => setOtherConfirmed(true)}
            >
              That is all my income this month
            </button>
          )}
        </div>
      </div>

      {result.error ? (
        <p style={{ margin: 0, fontSize: 'var(--t-s)', color: 'var(--ink-3)', fontStyle: 'italic' }}>
          {result.error}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Gross income */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 'var(--t-s)', color: 'var(--ink-2)' }}>This month's income</span>
            <span className="mono" style={{ fontWeight: 500 }}>S/ {result.grossSoles.toFixed(2)}</span>
          </div>

          {/* Threshold meter */}
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-3)' }}>Monthly threshold S/ {PERU_THRESHOLD_SOLES.toLocaleString()}</span>
              {result.crossesThreshold && <span className="badge warn">Above threshold</span>}
            </div>
            <div className="meter">
              <div
                className={`fill${result.crossesThreshold ? ' over' : ''}`}
                style={{ width: `${thresholdPct}%` }}
              />
            </div>
          </div>

          {result.crossesThreshold ? (
            <>
              <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 14, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 'var(--t-s)', color: 'var(--ink-2)' }}>Estimated prepayment (8%)</span>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 'var(--t-m)' }}>S/ {result.prepaymentSoles.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 'var(--t-s)', color: 'var(--ink-2)' }}>Reserve held</span>
                  <span className="mono" style={{ fontWeight: 500, color: result.reserveCovers ? 'var(--ok)' : 'var(--warn)' }}>
                    S/ {result.reserveSoles.toFixed(2)}
                  </span>
                </div>
                <div className={`badge ${result.reserveCovers ? 'ok' : 'warn'}`} style={{ alignSelf: 'flex-start' }}>
                  {result.reserveCovers ? 'Reserve covers the prepayment' : 'Reserve falls short — consider withdrawing less'}
                </div>
              </div>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--t-s)', color: 'var(--ok)' }}>
              Income is below the monthly threshold. No prepayment is due.
            </p>
          )}
        </div>
      )}

      <p style={{ margin: 0, fontSize: 'var(--t-xs)', color: 'var(--ink-3)' }}>
        <a
          href={PERU_THRESHOLD_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--ink-3)' }}
        >
          {PERU_THRESHOLD_SOURCE}
        </a>
      </p>
    </div>
  )
}
