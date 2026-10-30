import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check } from '@phosphor-icons/react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { Page } from '../components/Layout'
import { SplitBar, SplitLegend } from '../components/SplitBar'
import { HONORARIOS_ABI } from '../abi'
import { CONTRACT_ADDRESS, CONTRACT_CHAIN_ID } from '../deployments'
import { parseUsdc18, parseContractError } from '../lib/format'
import { buildShareLink } from '../lib/share'
import { publicClient, contractConfig, parseProfileTuple } from '../lib/contract'

const MAX_CONCEPT = 80

export function Issue() {
  const navigate = useNavigate()
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()

  const [ref, setRef] = useState('')
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({})
  const [txError, setTxError] = useState<string | null>(null)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [profile, setProfile] = useState<{ taxBps: number } | null>(null)

  // Load profile to show split preview
  useEffect(() => {
    if (!address) return
    publicClient.readContract({ ...contractConfig, functionName: 'profileOf', args: [address] })
      .then(p => {
        const parsed = parseProfileTuple(p)
        if (parsed) setProfile({ taxBps: parsed.taxBps })
      })
      .catch(() => {})
  }, [address])

  const previewAmount = (() => { try { return parseUsdc18(amount || '0') } catch { return 0n } })()
  const taxBps = profile?.taxBps ?? 800

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!ref.trim()) errs.ref = 'Reference is required.'
    else if (new TextEncoder().encode(ref).length > 32) errs.ref = 'Reference must be 32 bytes or fewer.'
    if (!amount || parseFloat(amount) <= 0) errs.amount = 'Amount must be greater than zero.'
    if (concept.length > MAX_CONCEPT) errs.concept = `Description must be ${MAX_CONCEPT} characters or fewer.`
    setFieldErr(errs)
    return Object.keys(errs).length === 0
  }

  const onSubmit = () => {
    if (!validate() || !address) return
    setTxError(null)
    if (chainId !== CONTRACT_CHAIN_ID) { switchChain({ chainId: CONTRACT_CHAIN_ID }); return }
    let parsed: bigint
    try { parsed = parseUsdc18(amount) } catch { setTxError('Invalid amount.'); return }
    writeContract(
      {
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: HONORARIOS_ABI,
        functionName: 'issue',
        args: [ref, parsed, concept],
        maxFeePerGas: 20_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n,
      },
      {
        onError(e) { setTxError(parseContractError(e)) },
        onSuccess() {
          void buildShareLink(`#/pay/${address}/${encodeURIComponent(ref)}`).then(setShareLink)
        },
      },
    )
  }

  const copyLink = () => {
    if (!shareLink) return
    void navigator.clipboard.writeText(shareLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <Page maxWidth={640}>
      <div className="enter">
        <h1 style={{ fontWeight: 600, letterSpacing: '-.02em', fontSize: 'var(--t-xl)', margin: '0 0 8px' }}>
          Issue a receipt
        </h1>
        <p style={{ color: 'var(--ink-2)', margin: '0 0 32px', lineHeight: 1.6 }}>
          Your client will pay the exact amount on the payment page. The reserve is set aside the moment they pay.
        </p>

        {!isConnected ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <p style={{ margin: 0, color: 'var(--ink-2)' }}>Connect your wallet to issue receipts.</p>
            <ConnectKitButton />
          </div>
        ) : isSuccess && shareLink ? (
          /* Success state */
          <div style={{ display: 'grid', gap: 24 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 'var(--r)', padding: 20 }}>
              <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--ok)' }}>Receipt issued</p>
              <p style={{ margin: 0, fontSize: 'var(--t-s)', color: 'var(--ink-2)' }}>
                Send this link to your client so they can pay.
              </p>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--rule-strong)', borderRadius: 'var(--r)', padding: 20, display: 'grid', gap: 16 }}>
              <p className="mono" style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', margin: 0 }}>
                Payment link
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, fontFamily: 'var(--f-mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-2)', wordBreak: 'break-all' }}>
                  {shareLink}
                </code>
                <button className="btn ghost" style={{ padding: '8px 12px', flexShrink: 0 }} onClick={copyLink} aria-label="Copy link">
                  {copied ? <Check size={16} weight="light" /> : <Copy size={16} weight="light" />}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <QRCodeSVG value={shareLink} size={160} level="M" style={{ borderRadius: 2 }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn ghost" onClick={() => { void navigate('/dashboard') }}>Go to dashboard</button>
              <button className="btn ghost" onClick={() => { setRef(''); setAmount(''); setConcept(''); setTxError(null); setShareLink(null) }}>
                Issue another
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 20 }}>
            <div className="field">
              <label htmlFor="ref">Reference</label>
              <input
                id="ref"
                type="text"
                maxLength={32}
                placeholder="E001-1"
                value={ref}
                onChange={e => setRef(e.target.value)}
                aria-invalid={!!fieldErr.ref}
              />
              {fieldErr.ref && <span style={{ fontSize: 'var(--t-xs)', color: 'var(--warn)' }}>{fieldErr.ref}</span>}
            </div>

            <div className="field">
              <label htmlFor="amount">Amount (USDC)</label>
              <input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                className="mono"
                placeholder="100.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                aria-invalid={!!fieldErr.amount}
              />
              {fieldErr.amount && <span style={{ fontSize: 'var(--t-xs)', color: 'var(--warn)' }}>{fieldErr.amount}</span>}
            </div>

            <div className="field">
              <label htmlFor="concept">
                Description{' '}
                <span style={{ color: concept.length > MAX_CONCEPT ? 'var(--warn)' : 'var(--ink-3)' }}>
                  {concept.length}/{MAX_CONCEPT}
                </span>
              </label>
              <textarea
                id="concept"
                maxLength={MAX_CONCEPT}
                placeholder="Website redesign, October"
                value={concept}
                onChange={e => setConcept(e.target.value)}
                aria-invalid={!!fieldErr.concept}
              />
              {fieldErr.concept && <span style={{ fontSize: 'var(--t-xs)', color: 'var(--warn)' }}>{fieldErr.concept}</span>}
            </div>

            {/* Live split preview */}
            {previewAmount > 0n && (
              <div style={{ padding: '14px 16px', border: '1px solid var(--rule)', borderRadius: 'var(--r)', display: 'grid', gap: 10 }}>
                <SplitBar taxBps={taxBps} />
                <SplitLegend taxBps={taxBps} amount={previewAmount} />
              </div>
            )}

            {txError && (
              <p style={{ color: 'var(--warn)', margin: 0, fontSize: 'var(--t-s)' }}>{txError}</p>
            )}

            <button className="btn" onClick={onSubmit} disabled={isPending || isConfirming}>
              {isPending ? <><span className="spinner" /> Confirm in wallet…</> :
               isConfirming ? <><span className="spinner" /> Confirming…</> :
               'Issue receipt'}
            </button>
          </div>
        )}
      </div>
    </Page>
  )
}
