import { polygon, polygonAmoy } from 'wagmi/chains';
import { getTargetChainId } from './chains';
import { getMetaMaskProvider } from '../wallet/connect';

const CHAIN_HEX: Record<number, `0x${string}`> = {
  137: '0x89',
  80002: '0x13882',
};

function getTargetChain() {
  const chainId = getTargetChainId();
  if (chainId === polygonAmoy.id) return polygonAmoy;
  return polygon;
}

function chainAddParams(chain: { id: number; name: string; nativeCurrency: { name: string; symbol: string; decimals: number }; rpcUrls: { default: { http: readonly string[] } }; blockExplorers?: { default: { url: string } } | undefined }) {
  const rpcUrls = chain.rpcUrls.default.http.filter(Boolean);
  const explorer = chain.blockExplorers?.default?.url;
  return {
    chainId: CHAIN_HEX[chain.id] ?? (`0x${chain.id.toString(16)}` as `0x${string}`),
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls,
    blockExplorerUrls: explorer ? [explorer] : [],
  };
}

/** Prompts MetaMask (or injected wallet) to switch to Polygon / Amoy; adds network if missing. */
export async function ensureWalletOnTargetChain(): Promise<void> {
  const provider = getMetaMaskProvider();
  if (!provider) return;

  const chainId = getTargetChainId();
  const hex = CHAIN_HEX[chainId] ?? (`0x${chainId.toString(16)}` as `0x${string}`);
  const targetChain = getTargetChain();

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hex }],
    });
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code !== 4902) throw error;

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [chainAddParams(targetChain)],
    });
  }
}

export { polygon, polygonAmoy };
