import { Link, useNavigate } from 'react-router-dom'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { NETWORK } from '../deployments'

function BrandMark() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" role="img" aria-label="Honorarios" style={{ flexShrink: 0 }}>
      <g transform="rotate(-90 12 12)" fill="none" strokeWidth="4">
        <circle cx="12" cy="12" r="8.5" pathLength="100" stroke="var(--ink)" strokeDasharray="90 10" strokeDashoffset="-9"/>
        <circle cx="12" cy="12" r="8.5" pathLength="100" stroke="var(--accent)" strokeDasharray="6 94" strokeDashoffset="-1"/>
      </g>
    </svg>
  )
}

export function TopBar() {
  useAccount() // keep hook for side-effects (chain tracking)
  const navigate = useNavigate()

  return (
    <header style={{
      borderBottom: '1px solid var(--rule)',
      background: 'var(--paper)',
      position: 'sticky', top: 0, zIndex: 40,
    }}>
      <div style={{
        maxWidth: 1120, margin: '0 auto',
        padding: '0 clamp(16px, 4vw, 48px)',
        height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--ink)' }}>
          <BrandMark />
          <span style={{ fontWeight: 600, letterSpacing: '-.02em', fontSize: 'var(--t-b)' }}>
            Honorarios
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="mono" style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            {NETWORK === 'testnet' ? 'Arc Testnet' : 'Arc Mainnet'}
          </span>
          <Link to="/proof" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-2)', textDecoration: 'none', padding: '8px 4px' }}>Proof</Link>
          <ConnectKitButton.Custom>
            {({ isConnected, show, address: addr }) => (
              <button
                className="btn ghost"
                onClick={() => {
                  if (isConnected && addr) { void navigate('/dashboard') }
                  else { void show?.() }
                }}
                style={{ padding: '8px 14px', fontSize: 'var(--t-xs)' }}
              >
                {isConnected && addr
                  ? `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`
                  : 'Connect wallet'}
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      </div>
    </header>
  )
}

interface PageProps { children: React.ReactNode; maxWidth?: number }
export function Page({ children, maxWidth = 1120 }: PageProps) {
  return (
    <main style={{ maxWidth, margin: '0 auto', padding: '0 clamp(16px, 4vw, 48px)', paddingTop: 48, paddingBottom: 96 }}>
      {children}
    </main>
  )
}
