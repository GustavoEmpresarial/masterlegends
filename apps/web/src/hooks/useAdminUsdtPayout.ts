import { useCallback, useMemo, useState } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useConnect,
  useDisconnect,
} from 'wagmi';
import { parseUnits, formatUnits, isAddress } from 'viem';
import { getAccount, getConnectors, waitForTransactionReceipt } from '@wagmi/core';
import { erc20Abi } from '../lib/web3/abis';
import { getUsdtAddress, USDT_DECIMALS, wagmiConfig } from '../lib/web3/config';
import { getTargetChainId } from '../lib/web3/chains';
import { ensureWalletOnTargetChain } from '../lib/web3/ensureChain';
import { connectWalletAndGetAddress } from '../lib/wallet/connect';

export type AdminPayoutStep =
  | 'idle'
  | 'connecting'
  | 'confirming'
  | 'approving'
  | 'done'
  | 'error';

function toUsdtUnits(amountUsdt: number): bigint {
  const safe = Number.isFinite(amountUsdt) ? Math.max(0, amountUsdt) : 0;
  return parseUnits(safe.toFixed(USDT_DECIMALS), USDT_DECIMALS);
}

function errText(err: unknown): string {
  if (!err) return '';
  if (err instanceof Error) return err.message || '';
  return String(err);
}

function shortErr(err: unknown): string {
  if (!err) return 'Falha desconhecida';
  const m = errText(err);
  if (/user rejected|rejected the request|denied|WALLET_USER_REJECTED/i.test(m)) {
    return 'Você cancelou na MetaMask.';
  }
  if (/WALLET_NOT_INSTALLED/i.test(m)) return 'Instale a MetaMask neste navegador.';
  if (/WALLET_REQUEST_PENDING/i.test(m)) {
    return 'Já tem um pedido aberto na MetaMask — confira o ícone da extensão.';
  }
  if (/already connected|not connected/i.test(m)) {
    return 'Falha ao sincronizar a carteira — clique em Conectar MetaMask de novo.';
  }
  if (/insufficient|exceeds balance/i.test(m)) return 'Saldo USDT insuficiente na carteira.';
  // Drop viem "Request Arguments / Contract Call / Docs" dump
  const firstLine = m.split(/\n|Request Arguments|Contract Call|Docs:/)[0]?.trim() || m;
  return firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine || 'Falha desconhecida';
}

/**
 * Admin payout: connect MetaMask → USDT.transfer(player, net) on Polygon → return txHash.
 */
export function useAdminUsdtPayout() {
  const targetChainId = getTargetChainId();
  const usdtToken = getUsdtAddress();

  const [step, setStep] = useState<AdminPayoutStep>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | undefined>();

  const { address: activeAddress, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const { data: usdtRaw, refetch: refetchUsdt } = useReadContract({
    address: usdtToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: activeAddress ? [activeAddress] : undefined,
    chainId: targetChainId,
    query: { enabled: !!usdtToken && !!activeAddress },
  });

  const {
    writeContractAsync: transferAsync,
    data: writeTxHash,
    isPending: isWritePending,
    reset: resetWrite,
  } = useWriteContract();

  const waitHash = lastTxHash ?? writeTxHash;
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: waitHash,
    chainId: targetChainId,
  });

  const usdtBalance = usdtRaw ? Number(formatUnits(usdtRaw, USDT_DECIMALS)) : 0;

  /** True only when we have a live address for signing. */
  const walletReady = !!activeAddress;

  const syncWagmiSession = useCallback(
    async (preferred?: `0x${string}`): Promise<`0x${string}`> => {
      const [connector] = getConnectors(wagmiConfig);
      if (!connector) throw new Error('WALLET_NOT_INSTALLED');

      const current = getAccount(wagmiConfig);
      if (
        current.address &&
        current.isConnected &&
        (!preferred || current.address.toLowerCase() === preferred.toLowerCase())
      ) {
        return current.address;
      }

      // Stale "connected" / "not connected" — hard reset then connect.
      try {
        await disconnectAsync({ connector });
      } catch {
        /* ignore */
      }

      const result = await connectAsync({ connector, chainId: targetChainId });
      const addr = result.accounts[0] ?? preferred;
      if (!addr) throw new Error('WALLET_NOT_INSTALLED');
      return addr;
    },
    [connectAsync, disconnectAsync, targetChainId],
  );

  const ensureConnected = useCallback(async (): Promise<`0x${string}`> => {
    if (activeAddress) return activeAddress;

    // 1) Talk to MetaMask directly (eth_requestAccounts) — reliable UX.
    const raw = (await connectWalletAndGetAddress()) as `0x${string}`;

    // 2) Sync wagmi so useWriteContract can sign.
    try {
      return await syncWagmiSession(raw);
    } catch (err) {
      const again = getAccount(wagmiConfig);
      if (again.address) return again.address;
      throw err;
    }
  }, [activeAddress, syncWagmiSession]);

  const ensurePolygon = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: targetChainId });
    } catch {
      await ensureWalletOnTargetChain();
    }
  }, [switchChainAsync, targetChainId]);

  const connectWallet = useCallback(async () => {
    setErrorMessage('');
    setStep('connecting');
    try {
      await ensureConnected();
      await ensurePolygon();
      await refetchUsdt();
      setStep('idle');
    } catch (err) {
      const msg = shortErr(err);
      setStep('error');
      setErrorMessage(msg);
      throw new Error(msg);
    }
  }, [ensureConnected, ensurePolygon, refetchUsdt]);

  /**
   * Opens MetaMask with USDT transfer to `toWallet` for `netUsdt`.
   * Resolves with tx hash after on-chain confirmation.
   */
  const payWithdrawal = useCallback(
    async (toWallet: string, netUsdt: number): Promise<`0x${string}`> => {
      setErrorMessage('');
      resetWrite();
      setLastTxHash(undefined);

      if (!usdtToken) {
        const msg = 'USDT Polygon não configurado (VITE_USDT).';
        setStep('error');
        setErrorMessage(msg);
        throw new Error(msg);
      }
      if (!isAddress(toWallet)) {
        const msg = 'Carteira do jogador inválida.';
        setStep('error');
        setErrorMessage(msg);
        throw new Error(msg);
      }
      if (!(netUsdt > 0)) {
        const msg = 'Valor de saque inválido.';
        setStep('error');
        setErrorMessage(msg);
        throw new Error(msg);
      }

      setStep('connecting');
      try {
        await ensureConnected();
        await ensurePolygon();
        void refetchUsdt();

        setStep('confirming');
        const hash = await transferAsync({
          chainId: targetChainId,
          address: usdtToken,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [toWallet as `0x${string}`, toUsdtUnits(netUsdt)],
        });
        setLastTxHash(hash);
        await waitForTransactionReceipt(wagmiConfig, { hash, chainId: targetChainId as 137 });
        return hash;
      } catch (err) {
        const msg = shortErr(err);
        setStep('error');
        setErrorMessage(msg);
        throw new Error(msg);
      }
    },
    [
      usdtToken,
      ensureConnected,
      ensurePolygon,
      refetchUsdt,
      transferAsync,
      targetChainId,
      resetWrite,
    ],
  );

  const reset = useCallback(() => {
    resetWrite();
    setLastTxHash(undefined);
    setErrorMessage('');
    setStep('idle');
  }, [resetWrite]);

  const busy =
    step === 'connecting' ||
    step === 'confirming' ||
    step === 'approving' ||
    isWritePending ||
    isConfirming;

  const networkLabel = useMemo(() => `Polygon (${targetChainId})`, [targetChainId]);

  return {
    step,
    setStep,
    busy,
    errorMessage,
    setErrorMessage,
    activeAddress,
    isConnected,
    walletReady,
    nativeBalance: usdtBalance,
    usdtAddress: usdtToken,
    networkLabel,
    targetChainId,
    isConfigured: !!usdtToken && targetChainId === 137,
    connectWallet,
    payWithdrawal,
    lastTxHash: waitHash,
    isConfirming,
    isConfirmed,
    reset,
    refetchBalances: async () => {
      await refetchUsdt();
    },
  };
}
