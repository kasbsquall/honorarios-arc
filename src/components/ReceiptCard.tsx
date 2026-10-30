import type { ReactNode } from 'react'
import { SplitBar, SplitLegend } from './SplitBar'
import { formatDate, shortAddr } from '../lib/format'

interface ReceiptCardProps {
  receiptRef: string
  concept: string
  amount: bigint
  taxBps: number
  paid: boolean
  payer?: `0x${string}`
  paidAt?: number
  txHash?: string
  torn?: boolean
  explorerBase?: string
  children?: ReactNode
}

export function ReceiptCard({
  receiptRef,
  concept,
  amount,
  taxBps,
  paid,
  payer,
  paidAt,
  txHash,
  torn,
  explorerBase,
  children,
}: ReceiptCardProps) {
  const whole = amount / 10n ** 18n
  const frac = (amount % 10n ** 18n) / 10n ** 16n
  const amountDisplay = `${whole}.${String(frac).padStart(2, '0')}`

  return (
    <div className={`receipt${torn ? ' torn' : ''}`}>
      <div className="body">
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <span className="mono" style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
            Invoice · {receiptRef}
          </span>
          <span className={`badge ${paid ? 'ok' : 'neutral'}`} style={{ flexShrink: 0 }}>
            {paid ? 'Paid' : 'Awaiting payment'}
          </span>
        </div>

        {/* Concept */}
        {concept && (
          <p style={{ margin: 0, fontSize: 'var(--t-m)', fontWeight: 600, letterSpacing: '-.015em', color: 'var(--ink)', textWrap: 'balance' }}>
            {concept}
          </p>
        )}

        {/* Amount hero */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="mono" style={{ fontSize: 'var(--t-2xl)', fontWeight: 500, lineHeight: .9, letterSpacing: '-.03em' }}>
            {amountDisplay}
          </span>
          <span className="mono" style={{ fontSize: 'var(--t-s)', color: 'var(--ink-3)' }}>USDC</span>
        </div>

        {/* Split bar */}
        <SplitBar taxBps={taxBps} />
        <SplitLegend taxBps={taxBps} amount={amount} />

        {/* Footer */}
        {paid && payer && paidAt ? (
          <div style={{ paddingTop: 4, borderTop: '1px solid var(--rule)' }}>
            <div className="mono" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-3)' }}>
              Paid by {shortAddr(payer)} · {formatDate(paidAt)}
              {txHash && explorerBase && (
                <>
                  {' · '}
                  <a
                    href={`${explorerBase}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--ink-3)', textDecoration: 'underline' }}
                  >
                    View transaction
                  </a>
                </>
              )}
            </div>
          </div>
        ) : null}

        {children}
      </div>

      {/* Stub */}
      <div className="stub">
        <span>Tax reserve · {taxBps / 100}%</span>
      </div>
    </div>
  )
}
