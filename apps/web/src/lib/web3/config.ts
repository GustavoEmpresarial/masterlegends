import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { polygon } from 'wagmi/chains';

import { POLYGON_USDC_BRIDGED, POLYGON_USDC_NATIVE, POLYGON_USDT } from '@mll/shared';
import { getMetaMaskProvider } from '../wallet/connect';

const rpcUrl =
  import.meta.env.VITE_RPC_URL || 'https://polygon-bor-rpc.publicnode.com';

export const wagmiConfig = createConfig({
  chains: [polygon],
  // MetaMask only — avoid waking Phantom / Ronin / other injected wallets on page load.
  multiInjectedProviderDiscovery: false,
  connectors: [
    injected({
      target: {
        id: 'metaMask',
        name: 'MetaMask',
        provider: (() => getMetaMaskProvider() ?? undefined) as never,
      },
    }),
  ],
  transports: {
    [polygon.id]: http(rpcUrl),
  },
});

export function getUsdcAddress(): `0x${string}` | undefined {
  const addr = import.meta.env.VITE_USDC || POLYGON_USDC_NATIVE;
  return addr ? (addr as `0x${string}`) : undefined;
}

export function getUsdcBridgedAddress(): `0x${string}` {
  return POLYGON_USDC_BRIDGED as `0x${string}`;
}

export function getVaultAddress(): `0x${string}` | undefined {
  /** Treasury wallet that receives USDC deposits (not a smart contract). */
  const addr = import.meta.env.VITE_CONTRACT_USDC_VAULT;
  return addr ? (addr as `0x${string}`) : undefined;
}

export const getDepositTreasuryAddress = getVaultAddress;

export const USDC_DECIMALS = 6;

/** USDT (Polygon) — moeda de saques a partir de 01/08/2026. */
export function getUsdtAddress(): `0x${string}` | undefined {
  const addr = import.meta.env.VITE_USDT || POLYGON_USDT;
  return addr ? (addr as `0x${string}`) : undefined;
}

export const USDT_DECIMALS = 6;
