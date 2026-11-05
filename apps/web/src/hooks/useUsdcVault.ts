import { useCallback, useMemo, useState } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useConnect,
} from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { erc20Abi } from '../lib/web3/abis';
import {
  getUsdcAddress,
  getUsdcBridgedAddress,
  getDepositTreasuryAddress,
  USDC_DECIMALS,
  wagmiConfig,
} from '../lib/web3/config';
import { getTargetChainId } from '../lib/web3/chains';
import { ensureWalletOnTargetChain } from '../lib/web3/ensureChain';
import { getConnectors } from '@wagmi/core';

export type DepositStep = 'idle' | 'transferring';

export function useUsdcVault(linkedWallet?: string | null, minDepositUsdc = 1) {
  const targetChainId = getTargetChainId();
  const [depositStep, setDepositStep] = useState<DepositStep>('idle');
  const { address: activeAddress } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { connectAsync } = useConnect();
  const usdcNative = getUsdcAddress();
  const usdcBridged = getUsdcBridgedAddress();
  const treasuryAddress = getDepositTreasuryAddress();

  const wallet = linkedWallet as `0x${string}` | undefined;
  const wrongAccount =
    !!wallet &&
    !!activeAddress &&
    activeAddress.toLowerCase() !== wallet.toLowerCase();
  /** True when session matches linked wallet, or browser wallet not connected yet. */
  const walletMatches = !!wallet && !wrongAccount;

  const readEnabled = !!wallet;

  const { data: nativeRaw, refetch: refetchNative } = useReadContract({
    address: usdcNative,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: wallet ? [wallet] : undefined,
    chainId: targetChainId,
    query: { enabled: !!usdcNative && readEnabled },
  });

  const { data: bridgedRaw, refetch: refetchBridged } = useReadContract({
    address: usdcBridged,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: wallet ? [wallet] : undefined,
    chainId: targetChainId,
    query: { enabled: readEnabled },
  });

  const {
    writeContractAsync: transferAsync,
    data: depositTxHash,
    isPending: isDepositPending,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract();

  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } =
    useWaitForTransactionReceipt({ hash: depositTxHash, chainId: targetChainId });

  const nativeBalance = nativeRaw ? Number(formatUnits(nativeRaw, USDC_DECIMALS)) : 0;
  const bridgedBalance = bridgedRaw ? Number(formatUnits(bridgedRaw, USDC_DECIMALS)) : 0;
  const walletUsdcBalance = nativeBalance + bridgedBalance;
  const minDeposit = minDepositUsdc;

  const refetchAll = useCallback(async () => {
    await Promise.all([refetchNative(), refetchBridged()]);
  }, [refetchNative, refetchBridged]);

  const ensureBrowserSession = useCallback(async () => {
    let address = activeAddress;
    if (!address) {
      const [connector] = getConnectors(wagmiConfig);
      if (!connector) throw new Error('WALLET_NOT_INSTALLED');
      const result = await connectAsync({ connector, chainId: targetChainId });
      address = result.accounts[0];
    }
    if (!wallet || !address || address.toLowerCase() !== wallet.toLowerCase()) {
      throw new Error('WALLET_WRONG_ACCOUNT');
    }
  }, [activeAddress, connectAsync, targetChainId, wallet]);

  const ensurePolygon = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: targetChainId });
    } catch {
      await ensureWalletOnTargetChain();
    }
  }, [switchChainAsync, targetChainId]);

  const pickUsdcForAmount = useCallback(
    (amount: number): `0x${string}` | null => {
      if (!usdcNative) return null;
      if (nativeBalance >= amount) return usdcNative;
      if (bridgedBalance >= amount) return usdcBridged;
      return null;
    },
    [usdcNative, usdcBridged, nativeBalance, bridgedBalance],
  );

  const transferDeposit = useCallback(
    async (amount: string) => {
      if (!treasuryAddress || !wallet) return;
      const parsedAmount = Number(amount);
      const tokenAddress = pickUsdcForAmount(parsedAmount);
      if (!tokenAddress) return;

      resetDeposit();
      setDepositStep('transferring');
      try {
        await ensureBrowserSession();
        await ensurePolygon();
        const parsed = parseUnits(amount, USDC_DECIMALS);
        await transferAsync({
          chainId: targetChainId,
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [treasuryAddress, parsed],
        });
      } catch {
        setDepositStep('idle');
        throw new Error('DEPOSIT_FAILED');
      }
    },
    [
      treasuryAddress,
      wallet,
      pickUsdcForAmount,
      transferAsync,
      ensureBrowserSession,
      ensurePolygon,
      targetChainId,
      resetDeposit,
    ],
  );

  const resetDepositFlow = useCallback(() => {
    resetDeposit();
    setDepositStep('idle');
  }, [resetDeposit]);

  const networkLabel = useMemo(() => `Polygon (${targetChainId})`, [targetChainId]);

  return {
    usdcAddress: usdcNative,
    treasuryAddress,
    walletMatches,
    wrongAccount,
    activeAddress,
    walletUsdcBalance,
    nativeBalance,
    bridgedBalance,
    minDeposit,
    transferDeposit,
    depositTxHash,
    depositStep,
    isDepositPending,
    isDepositConfirming,
    isDepositSuccess,
    depositError,
    resetDepositFlow,
    refetchAll,
    networkLabel,
    targetChainId,
    isConfigured: !!usdcNative && !!treasuryAddress && targetChainId === 137,
  };
}
