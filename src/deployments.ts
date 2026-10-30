/**
 * Network and contract address configuration.
 * Mainnet address + deploy block come from .env and may be empty before deployment.
 */
export type NetworkKey = 'testnet' | 'mainnet'

export const NETWORK: NetworkKey =
  import.meta.env.VITE_NETWORK === 'testnet' ? 'testnet' : 'mainnet'

// ── Testnet ────────────────────────────────────────────────────────────────────
export const TESTNET_ADDRESS = '0xe4710978da3541cd80468775324aab602e1def28' as const
export const TESTNET_CHAIN_ID = 5042002
export const TESTNET_DEPLOY_BLOCK = 0x41df601 // hex block from deploy tx receipt

// ── Mainnet ────────────────────────────────────────────────────────────────────
// These are intentionally empty until a mainnet deploy is executed.
// The app shows a "not deployed yet" state when VITE_HONORARIOS_ADDRESS_MAINNET is empty.
const _mainnetAddr: string = (import.meta.env.VITE_HONORARIOS_ADDRESS_MAINNET as string | undefined) ?? ''
const _mainnetBlock: number = Number((import.meta.env.VITE_DEPLOY_BLOCK_MAINNET as string | undefined) ?? '0')
export const MAINNET_ADDRESS: string = _mainnetAddr
export const MAINNET_CHAIN_ID = 5042
export const MAINNET_DEPLOY_BLOCK: number = _mainnetBlock

// ── Active network ─────────────────────────────────────────────────────────────
export const CONTRACT_ADDRESS: string = NETWORK === 'testnet' ? TESTNET_ADDRESS : MAINNET_ADDRESS
export const CONTRACT_CHAIN_ID: number = NETWORK === 'testnet' ? TESTNET_CHAIN_ID : MAINNET_CHAIN_ID
export const CONTRACT_DEPLOY_BLOCK: number =
  NETWORK === 'testnet' ? TESTNET_DEPLOY_BLOCK : MAINNET_DEPLOY_BLOCK

/** True when the active contract is deployed and the app can function. */
export const IS_DEPLOYED: boolean =
  NETWORK === 'testnet' ? true : _mainnetAddr !== ''

export const DEMO_FREELANCER: `0x${string}` =
  (import.meta.env.VITE_DEMO_FREELANCER as `0x${string}` | undefined) ??
  '0x0000000000000000000000000000000000000000'
