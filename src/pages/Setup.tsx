import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { Page } from '../components/Layout'
import { SplitBar, SplitLegend } from '../components/SplitBar'
import { HONORARIOS_ABI } from '../abi'
import { CONTRACT_ADDRESS, CONTRACT_CHAIN_ID } from '../deployments'
import { parseContractError } from '../lib/format'

const PERU = { taxBps: 800, utcOffsetMin: -300, label: 'Peru (8%, Lima time UTC-5)' }

export function Setup() {
  const navigate = useNavigate()
  const { chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()

  const [mode, setMode] = useState<'peru' | 'custom'>('peru')
  const [customPct, setCustomPct] = useState('8')
  const [customOffset, setCustomOffset] = useState('-300')
  const [txError, setTxError] = useState<string | null>(null)

  const taxBps = mode === 'peru' ? PERU.taxBps : Math.round(parseFloat(customPct || '0') * 100)
  const utcOffsetMin = mode === 'peru' ? PERU.utcOffsetMin : parseInt(customOffset || '0', 10)

  const previewTaxBps = isNaN(taxBps) || taxBps < 0 ? 0 : Math.min(taxBps, 5000)

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const onSubmit = () => {
    if (!isConnected) return
    setTxError(null)
    if (chainId !== CONTRACT_CHAIN_ID) { switchChain({ chainId: CONTRACT_CHAIN_ID }); return }
    writeContract(
      {
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: HONORARIOS_ABI,
        functionName: 'setProfile',
        args: [taxBps, utcOffsetMin],
        maxFeePerGas: 20_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n,
      },
      {
        onError(e) { setTxError(parseContractError(e)) },
        onSuccess() { setTimeout(() => { void navigate('/dashboard') }, 1800) },
      },
    )
  }

  const pctNum = parseFloat(customPct)
  const customValid = mode === 'custom' && !isNaN(pctNum) && pctNum >= 0 && pctNum <= 50

  return (
    <Page maxWidth={640}>
      <div className="enter">
        <h1 style={{ fontWeight: 600, letterSpacing: '-.02em', fontSize: 'var(--t-xl)', margin: '0 0 8px' }}>
          Where do you pay taxes?
        </h1>
        <p style={{ color: 'var(--ink-2)', margin: '0 0 32px', lineHeight: 1.6 }}>
          Honorarios will set aside this percentage of every payment the moment it arrives.
        </p>

        {!isConnected ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <p style={{ color: 'var(--ink-2)', margin: 0 }}>Connect your wallet to save your tax profile.</p>
            <ConnectKitButton />
          </div>
        ) : (
          <>
            {/* Option buttons */}
            <div style={{ display: 'grid', gap: 10, marginBottom: 32 }}>
              <button
                className={`btn ${mode === 'peru' ? '' : 'ghost'}`}
                onClick={() => setMode('peru')}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                <span style={{ flex: 1 }}>Peru (8%, Lima time, UTC-5)</span>
                {mode === 'peru' && <span className="badge accent" style={{ fontSize: 'var(--t-xs)' }}>Selected</span>}
              </button>
              <button
                className={`btn ${mode === 'custom' ? '' : 'ghost'}`}
                onClick={() => setMode('custom')}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                <span style={{ flex: 1 }}>Other country — set my own percentage</span>
                {mode === 'custom' && <span className="badge accent" style={{ fontSize: 'var(--t-xs)' }}>Selected</span>}
              </button>
            </div>

            {mode === 'custom' && (
              <div style={{ marginBottom: 24, padding: 16, border: '1px solid var(--rule)', borderRadius: 'var(--r)', display: 'grid', gap: 16 }}>
                <p style={{ margin: 0, fontSize: 'var(--t-s)', color: 'var(--ink-2)' }}>
                  Honorarios does not know the rules of your country. You choose the percentage.
                </p>
                <div className="field">
                  <label htmlFor="custom-pct">Reserve percentage (0 to 50)</label>
                  <input
                    id="custom-pct"
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    className="mono"
                    value={customPct}
                    onChange={e => setCustomPct(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="custom-offset">UTC offset in minutes (e.g. -300 for UTC-5)</label>
                  <input
                    id="custom-offset"
                    type="number"
                    min="-720"
                    max="840"
                    step="30"
                    className="mono"
                    value={customOffset}
                    onChange={e => setCustomOffset(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Live preview */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: '0 0 8px', fontSize: 'var(--t-s)', color: 'var(--ink-3)' }}>
                On a payment of 100.00 USDC:
              </p>
              <SplitBar taxBps={previewTaxBps} />
              <div style={{ marginTop: 10 }}>
                <SplitLegend taxBps={previewTaxBps} amount={100n * 10n ** 18n} />
              </div>
            </div>

            {txError && (
              <p style={{ color: 'var(--warn)', margin: '0 0 16px', fontSize: 'var(--t-s)' }}>{txError}</p>
            )}

            {isSuccess ? (
              <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 'var(--r)' }}>
                <p style={{ margin: 0, color: 'var(--ok)', fontWeight: 500 }}>Profile saved. Taking you to your dashboard…</p>
              </div>
            ) : (
              <button
                className="btn"
                onClick={onSubmit}
                disabled={isPending || isConfirming || (mode === 'custom' && !customValid)}
              >
                {isPending ? <><span className="spinner" /> Confirm in wallet…</> :
                 isConfirming ? <><span className="spinner" /> Saving…</> :
                 'Save profile'}
              </button>
            )}

            {chainId !== CONTRACT_CHAIN_ID && isConnected && (
              <p style={{ marginTop: 12, fontSize: 'var(--t-s)', color: 'var(--warn)' }}>
                Your wallet is on a different network. Clicking Save will ask you to switch.
              </p>
            )}
          </>
        )}
      </div>
    </Page>
  )
}
