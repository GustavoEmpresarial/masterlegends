import { useAccount } from 'wagmi';
import { getTargetChainId } from '../lib/web3/chains';

/**
 * Read-only chain status for wallet UI.
 * Never prompts wallets — chain switch only happens on explicit user actions
 * (connect / deposit).
 */
export function useEnsureTargetChain() {
  const targetChainId = getTargetChainId();
  const { chainId, isConnected } = useAccount();

  return {
    chainId,
    targetChainId,
    onTargetChain: !isConnected || chainId === targetChainId,
  };
}
