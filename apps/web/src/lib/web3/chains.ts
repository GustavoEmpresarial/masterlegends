import { POLYGON_CHAIN_ID } from '@mll/shared';

const AMOY_CHAIN_ID = 80002;

export function getTargetChainId(): number {
  const raw = import.meta.env.VITE_CHAIN_ID;
  const id = Number(raw);
  if (Number.isFinite(id) && id > 0) return id;
  return POLYGON_CHAIN_ID;
}

export function getExplorerTxUrl(txHash: string): string {
  const chainId = getTargetChainId();
  if (chainId === AMOY_CHAIN_ID) {
    return `https://amoy.polygonscan.com/tx/${txHash}`;
  }
  return `https://polygonscan.com/tx/${txHash}`;
}
