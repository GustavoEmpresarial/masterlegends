import { useBalance } from 'wagmi';
import { formatUnits } from 'viem';
import { getTargetChainId } from '../lib/web3/chains';

export function useNativeBalance(address?: string | null) {
  const { data, isLoading, refetch } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: getTargetChainId(),
    query: { enabled: !!address },
  });

  return {
    balance: data ? Number(formatUnits(data.value, data.decimals)) : 0,
    symbol: data?.symbol ?? 'POL',
    isLoading,
    refetch,
  };
}
