/**
 * wagmi configuration — Arc Testnet + Arc Mainnet + Ethereum mainnet (ENS).
 * Uses fallback([...]) transports for resilience against 429s.
 */
import { http, createConfig, fallback } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet as _arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { defineChain } from 'viem'
import { registerChain } from './tracing'

/** arcTestnet with Multicall3 address so viem batches reads correctly. */
export const arcTestnet = defineChain({
  ..._arcTestnet,
  contracts: {
    ..._arcTestnet.contracts,
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' as const },
  },
})

export const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        'https://rpc.mainnet.arc.io',
        'https://rpc.drpc.mainnet.arc.io',
        'https://rpc.quicknode.mainnet.arc.io',
        'https://rpc.blockdaemon.mainnet.arc.io',
      ],
    },
  },
  blockExplorers: { default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' as const } },
})

registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
registerChain(arcMainnet.id, 'https://rpc.mainnet.arc.io')

/** Fallback transport for Arc mainnet with 4 endpoints */
const arcMainnetTransport = fallback([
  http('https://rpc.mainnet.arc.io'),
  http('https://rpc.drpc.mainnet.arc.io'),
  http('https://rpc.quicknode.mainnet.arc.io'),
  http('https://rpc.blockdaemon.mainnet.arc.io'),
])

export const config = createConfig({
  chains: [arcTestnet, arcMainnet, mainnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.io'),
    [arcMainnet.id]: arcMainnetTransport,
    [mainnet.id]: http(),
  },
})
