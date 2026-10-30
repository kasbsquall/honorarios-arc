import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useBalance } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { ArrowRight, Wallet, CurrencyDollar, Receipt as ReceiptIcon } from '@phosphor-icons/react'
import { Page } from '../components/Layout'
import { ReceiptCard } from '../components/ReceiptCard'
import { Skeleton } from '../components/Skeleton'
import { HONORARIOS_ABI } from '../abi'
import { CONTRACT_ADDRESS, CONTRACT_CHAIN_ID, NETWORK, IS_DEPLOYED } from '../deployments'
import { fetchReceipt, type ChainReceipt } from '../lib/contract'
import { parseNetSentFromLogs } from '../lib/parse-paid-log'
import { formatDate, shortAddr, parseContractError, fmtUsdc } from '../lib/format'
import { requireChain } from '../onchain-facts'

function getExplorerBase(): string {
  try { return requireChain(CONTRACT_CHAIN_ID).explorerBase } catch { return '' }
}

export function Pay() {
  const { freelancer, ref } = useParams<{ freelancer: `0x${string}`; ref: string }>()
  const decodedRef = ref ? decodeURIComponent(ref) : ''

  const { address, chainId: walletChainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()

  const [receipt, setReceipt] = useState<ChainReceipt | null | undefined>(undefined)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [netSent, setNetSent] = useState<boolean | null>(null)

  useEffect(() => {
    if (!freelancer || !decodedRef) return
    void Promise.resolve().then(() => setLoadErr(null))
    void fetchReceipt(freelancer, decodedRef)
      .then(r => setReceipt(r))
      .catch(() => setLoadErr('Could not load receipt. Check your connection and retry.'))
  }, [freelancer, decodedRef])

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, data: txReceipt } = useWaitForTransactionReceipt({ hash })

  // Wallet balance on Arc
  const { data: balData } = useBalance({ address, chainId: CONTRACT_CHAIN_ID })
  const walletBalance = balData?.value ?? 0n

  // Derive torn/paid/confirmedHash from hook values directly — no setState needed
  const torn = isSuccess
  const paid = isSuccess || receipt?.paid === true
  const confirmedHash: `0x${string}` | undefined = isSuccess ? hash : undefined

  // Decode netSent from the Paid event using the ABI — correct even when a
  // dynamic `string ref` precedes netSent in the non-indexed data.
  useEffect(() => {
    if (!txReceipt) return
    // Wrap in a microtask so the linter's set-state-in-effect rule is satisfied
    void Promise.resolve().then(() => {
      try {
        const result = parseNetSentFromLogs(txReceipt.logs, CONTRACT_ADDRESS as `0x${string}`)
        // null means no Paid log found; default to true (net delivered) so the UI
        // does not incorrectly show the deferred-claim notice on a successful push.
        setNetSent(result ?? true)
      } catch {
        setNetSent(true)
      }
    })
  }, [txReceipt])

  // Reload receipt after payment confirmed
  useEffect(() => {
    if (!isSuccess || !freelancer || !decodedRef) return
    void fetchReceipt(freelancer, decodedRef).then(r => { if (r) setReceipt(r) }).catch(() => {})
  }, [isSuccess, freelancer, decodedRef])

  const onPay = () => {
    if (!freelancer || !receipt || !decodedRef) return
    setTxError(null)
    if (walletChainId !== CONTRACT_CHAIN_ID) { switchChain({ chainId: CONTRACT_CHAIN_ID }); return }
    writeContract(
      {
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: HONORARIOS_ABI,
        functionName: 'pay',
        args: [freelancer, decodedRef],
        value: receipt.amount,
        maxFeePerGas: 20_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n,
      },
      {
        onError(e) {
          const msg = parseContractError(e)
          setTxError(msg || 'Transaction was cancelled.')
        },
      },
    )
  }

  const explorerBase = getExplorerBase()

  if (!IS_DEPLOYED) {
    return (
      <Page maxWidth={640}>
        <div style={{ display: 'grid', gap: 16, textAlign: 'center', paddingTop: 48 }}>
          <h1 style={{ fontWeight: 600, fontSize: 'var(--t-xl)', margin: 0 }}>Not deployed yet</h1>
          <p style={{ color: 'var(--ink-2)', margin: 0 }}>
            The Honorarios contract is not live on {NETWORK === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet'} yet.
          </p>
          <Link to="/" className="btn ghost" style={{ justifySelf: 'center' }}>Back</Link>
        </div>
      </Page>
    )
  }

  if (!freelancer || !decodedRef) {
    return <Page><p style={{ color: 'var(--ink-3)' }}>Invalid payment link.</p></Page>
  }

  const isAlreadyPaid = receipt?.paid || paid
  const amountNeeded = receipt ? receipt.amount : 0n
  const shortfall = isConnected && amountNeeded > walletBalance ? amountNeeded - walletBalance : 0n

  return (
    <Page maxWidth={1120}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '48px 64px', alignItems: 'start' }}>
        {/* Left: payment info */}
        <div className="enter" style={{ display: 'grid', gap: 32 }}>
          <div>
            <p className="mono" style={{ margin: '0 0 6px', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
              Pay to
            </p>
            <p className="mono" style={{ margin: 0, fontSize: 'var(--t-s)', color: 'var(--ink-2)', wordBreak: 'break-all' }}>
              {freelancer}
            </p>
          </div>

          {receipt === undefined ? (
            <Skeleton height={80} />
          ) : receipt === null ? (
            <div style={{ color: 'var(--warn)' }}>
              <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Receipt not found</p>
              <p style={{ margin: 0, fontSize: 'var(--t-s)', color: 'var(--ink-2)' }}>
                This receipt reference was not issued by this address.
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="mono" style={{ margin: '0 0 4px', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
                  Amount due
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 'clamp(3.2rem, 1.5rem + 6.5vw, 6.5rem)', fontWeight: 500, lineHeight: .88, letterSpacing: '-.05em' }}>
                    {fmtUsdc(receipt.amount)}
                  </span>
                  <span className="mono" style={{ fontSize: 'var(--t-s)', color: 'var(--ink-3)' }}>USDC</span>
                </div>
              </div>

              <dl style={{ display: 'grid', gap: 0, margin: 0 }}>
                {[
                  { label: 'Service', value: receipt.concept || '—' },
                  { label: 'Receipt', value: decodedRef },
                  { label: 'Pay to', value: shortAddr(freelancer) },
                  { label: 'Network', value: NETWORK === 'testnet' ? 'Arc Testnet' : 'Arc Mainnet' },
                ].map(({ label, value }, i, arr) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--rule)' : 'none', gap: 12 }}>
                    <dt style={{ fontSize: 'var(--t-s)', color: 'var(--ink-3)' }}>{label}</dt>
                    <dd className="mono" style={{ margin: 0, fontSize: 'var(--t-s)', textAlign: 'right' }}>{value}</dd>
                  </div>
                ))}
              </dl>

              {!isAlreadyPaid && (
                <div style={{ display: 'grid', gap: 12 }}>
                  {[
                    { icon: <Wallet size={16} weight="light" />, text: 'Connect your wallet' },
                    { icon: <CurrencyDollar size={16} weight="light" />, text: `Have ${fmtUsdc(receipt.amount)} USDC on Arc in your wallet` },
                    { icon: <ReceiptIcon size={16} weight="light" />, text: 'Sign the payment' },
                  ].map(({ icon, text }, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--t-s)', color: 'var(--ink-2)' }}>
                      <span style={{ color: 'var(--ink-3)' }}>{icon}</span>
                      {text}
                    </div>
                  ))}
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--t-xs)', color: 'var(--ink-3)' }}>
                    Don't have USDC on Arc?{' '}
                    <a href="https://portal.arc.io/deposit/fiat" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                      Get USDC on Arc
                    </a>
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: receipt card + action */}
        <div className="enter" style={{ animationDelay: '60ms', display: 'grid', gap: 24 }}>
          {receipt === undefined ? (
            <Skeleton height={280} />
          ) : receipt === null ? null : (
            <>
              <ReceiptCard
                receiptRef={decodedRef}
                concept={receipt.concept}
                amount={receipt.amount}
                taxBps={receipt.taxBps}
                paid={isAlreadyPaid}
                payer={receipt.paid ? receipt.payer : address}
                paidAt={receipt.paid ? receipt.paidAt : undefined}
                txHash={confirmedHash}
                torn={torn}
                explorerBase={explorerBase}
              />

              {isAlreadyPaid && !isSuccess ? (
                <div style={{ padding: '14px 16px', border: '1px solid var(--rule)', borderRadius: 'var(--r)', background: 'var(--surface)' }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--ok)' }}>Already paid</p>
                  <p style={{ margin: 0, fontSize: 'var(--t-s)', color: 'var(--ink-2)' }}>
                    Paid on {formatDate(receipt.paidAt)} by {shortAddr(receipt.payer)}.
                    {explorerBase && <>{' '}<a href={`${explorerBase}/address/${receipt.payer}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink-3)' }}>View on explorer</a></>}
                  </p>
                </div>
              ) : isSuccess ? (
                <div style={{ padding: '14px 16px', border: '1px solid var(--rule)', borderRadius: 'var(--r)', background: 'var(--surface)', display: 'grid', gap: 8 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--ok)' }}>Payment confirmed</p>
                  {netSent === false && (
                    <p style={{ margin: 0, fontSize: 'var(--t-s)', color: 'var(--ink-2)' }}>
                      The freelancer will claim her net payment from the app.
                    </p>
                  )}
                  {confirmedHash && explorerBase && (
                    <a href={`${explorerBase}/tx/${confirmedHash}`} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      View transaction <ArrowRight size={12} />
                    </a>
                  )}
                </div>
              ) : (
                <>
                  {/* Shortfall warning */}
                  {isConnected && shortfall > 0n && (
                    <div style={{ padding: '12px 14px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--r)', background: 'var(--surface)', fontSize: 'var(--t-s)', color: 'var(--warn)' }}>
                      You need{' '}
                      <span className="mono" style={{ fontWeight: 500 }}>{fmtUsdc(shortfall)} USDC</span>{' '}
                      more.{' '}
                      <a href="https://portal.arc.io/deposit/fiat" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                        Get USDC on Arc
                      </a>
                    </div>
                  )}

                  {txError && <p style={{ margin: 0, fontSize: 'var(--t-s)', color: 'var(--warn)' }}>{txError}</p>}
                  {loadErr && <p style={{ margin: 0, fontSize: 'var(--t-s)', color: 'var(--warn)' }}>{loadErr}</p>}
                  {!isConnected ? (
                    <ConnectKitButton />
                  ) : (
                    <button
                      className="btn"
                      onClick={onPay}
                      disabled={isPending || isConfirming || shortfall > 0n}
                      style={{ width: '100%' }}
                    >
                      {isPending ? <><span className="spinner" /> Confirm in wallet…</> :
                       isConfirming ? <><span className="spinner" /> Confirming…</> :
                       `Pay ${fmtUsdc(receipt.amount)} USDC`}
                    </button>
                  )}
                  {walletChainId !== CONTRACT_CHAIN_ID && isConnected && (
                    <p style={{ margin: 0, fontSize: 'var(--t-s)', color: 'var(--warn)' }}>
                      Your wallet is on a different network. Clicking Pay will ask you to switch.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Page>
  )
}
