import { useMutation, useQueryClient } from '@tanstack/react-query';
import { connect as wagmiConnect, getAccount, getConnectors } from '@wagmi/core';
import type { WalletChallengeDTO, WalletLinkResponseDTO } from '@mll/shared';
import { apiClient } from '../lib/api/client';
import { useAuth } from './useAuth';
import {
  connectWalletAndGetAddress,
  fetchWalletChallenge,
  isWalletInstalled,
  normalizeWalletConnectError,
  signWalletMessage,
} from '../lib/wallet/connect';
import { reportFailure } from '../lib/telemetry/reportFailure';
import { getTargetChainId } from '../lib/web3/chains';
import { wagmiConfig } from '../lib/web3/config';

async function getChallenge(): Promise<WalletChallengeDTO> {
  const { data } = await apiClient.get<WalletChallengeDTO>('/auth/wallet/challenge');
  return data;
}

async function linkWallet(payload: { address: string; signature: string }): Promise<WalletLinkResponseDTO> {
  const { data } = await apiClient.post<WalletLinkResponseDTO>('/auth/wallet/link', payload);
  return data;
}

async function unlinkWallet(): Promise<void> {
  await apiClient.delete('/auth/wallet/link');
}

export type WalletConnectStep = 'idle' | 'challenge' | 'connect' | 'sign' | 'linking';

export function useWalletLink() {
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const onWalletChanged = () => {
    void refreshUser();
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet-history'] });
  };

  const connect = useMutation({
    mutationFn: async (onStep?: (step: WalletConnectStep) => void) => {
      // API first — session stays valid before MetaMask popups (unlock + sign back-to-back).
      onStep?.('challenge');
      const challenge = await fetchWalletChallenge(getChallenge);

      onStep?.('connect');
      const linked = getAccount(wagmiConfig);
      if (!linked.address) {
        const [connector] = getConnectors(wagmiConfig);
        if (!connector) throw new Error('WALLET_NOT_INSTALLED');
        try {
          await wagmiConnect(wagmiConfig, {
            connector,
            chainId: getTargetChainId() as 137,
          });
        } catch (err) {
          // wagmi's own account state can lag behind the connector (e.g. after a
          // previous attempt connected but a later step failed/was retried) — the
          // connector itself is already connected, so just proceed and read the
          // live address straight from the provider below instead of failing.
          const alreadyConnected =
            (err as { name?: string })?.name === 'ConnectorAlreadyConnectedError' ||
            /already connected/i.test((err as Error)?.message ?? '');
          if (!alreadyConnected) {
            const normalized = normalizeWalletConnectError(err);
            reportFailure({
              kind: 'wallet_connect',
              reason: normalized.message,
              context: { rawMessage: (err as Error)?.message ?? null },
            });
            throw normalized;
          }
        }
      }

      const address = await connectWalletAndGetAddress();

      onStep?.('sign');
      const signature = await signWalletMessage(address, challenge.message);

      onStep?.('linking');
      return linkWallet({ address, signature });
    },
    onSuccess: () => {
      onWalletChanged();
    },
  });

  const disconnect = useMutation({
    mutationFn: unlinkWallet,
    onSuccess: () => {
      onWalletChanged();
    },
  });

  return { connect, disconnect, isWalletInstalled: isWalletInstalled };
}
