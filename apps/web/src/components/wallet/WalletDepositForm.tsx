import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import type { TrackDepositResponseDTO } from '@mll/shared';
import { useUsdcVault } from '../../hooks/useUsdcVault';
import { useWalletSummary } from '../../hooks/useApi';
import { apiClient } from '../../lib/api/client';
import { getExplorerTxUrl } from '../../lib/web3/chains';
import { formatWalletAddress } from '../../lib/wallet/connect';
import { WalletPanel } from './WalletPanel';
import { WalletMinAmountCallout } from './WalletMinAmountCallout';

interface WalletDepositFormProps {
  linkedWallet: string | null | undefined;
}

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

function normalizeTxHash(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  return withPrefix.toLowerCase();
}

function depositTrackReasonMessage(reason: string | undefined, t: (k: string, o?: Record<string, unknown>) => string): string {
  switch (reason) {
    case 'tx_not_confirmed':
      return t('wallet.deposit.pendingConfirm', { defaultValue: 'Transação ainda não confirmada. Verificaremos automaticamente a cada 10 minutos.' });
    case 'deposit_wallet_mismatch':
      return t('wallet.deposit.walletMismatch', { defaultValue: 'O depósito deve vir da wallet vinculada à sua conta.' });
    case 'deposit_not_to_treasury':
      return t('wallet.deposit.notToTreasury', { defaultValue: 'Transação não enviou USDC para o endereço de depósito do jogo.' });
    case 'deposit_below_minimum':
      return t('wallet.deposit.belowMin', { defaultValue: 'Valor abaixo do depósito mínimo.' });
    case 'deposit_tx_too_old':
      return t('wallet.deposit.tooOld', { defaultValue: 'Transação muito antiga (máx. 30 dias).' });
    case 'deposit_claim_rate_limit':
      return t('wallet.deposit.rateLimit', { defaultValue: 'Limite de solicitações atingido. Tente em 1 hora.' });
    default:
      return t('wallet.deposit.trackFailed');
  }
}

function TrackStatusMessages({
  trackStatus,
  trackError,
  t,
}: {
  trackStatus: 'idle' | 'tracking' | 'queued' | 'credited' | 'pending' | 'error';
  trackError: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  if (trackStatus === 'queued' || trackStatus === 'credited') {
    return (
      <p className="retro-text text-sm" style={{ color: 'var(--green)' }}>
        {trackStatus === 'credited' ? t('wallet.deposit.credited') : t('wallet.deposit.queued')}
      </p>
    );
  }
  if (trackStatus === 'pending') {
    return (
      <p className="retro-text text-sm" style={{ color: 'var(--blue)' }}>
        {depositTrackReasonMessage('tx_not_confirmed', t)}
      </p>
    );
  }
  if (trackStatus === 'error') {
    return (
      <p className="retro-text text-sm" style={{ color: 'var(--orange)' }}>
        {trackError || t('wallet.deposit.trackFailed')}
      </p>
    );
  }
  return null;
}

export function WalletDepositForm({ linkedWallet }: WalletDepositFormProps) {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const { data: summary } = useWalletSummary();
  const [amount, setAmount] = useState('');
  const [manualHash, setManualHash] = useState('');
  const [copied, setCopied] = useState(false);
  const [trackStatus, setTrackStatus] = useState<'idle' | 'tracking' | 'queued' | 'credited' | 'pending' | 'error'>('idle');
  const [trackError, setTrackError] = useState('');
  const trackedHashRef = useRef<string | null>(null);
  const vault = useUsdcVault(linkedWallet, summary?.minDepositUsdc ?? 1);

  const treasuryAddress = summary?.usdcVaultAddress ?? vault.treasuryAddress;
  const minDeposit = summary?.minDepositUsdc ?? vault.minDeposit ?? 1;

  useEffect(() => {
    if (!vault.isDepositSuccess || !vault.depositTxHash) return;
    if (trackedHashRef.current === vault.depositTxHash) return;
    trackedHashRef.current = vault.depositTxHash;

    setTrackStatus('tracking');
    setTrackError('');
    void apiClient
      .post<TrackDepositResponseDTO>('/api/wallet/deposits/track', {
        txHash: vault.depositTxHash,
      })
      .then((res) => {
        if (res.data.status === 'already_credited' || res.data.status === 'credited') {
          setTrackStatus('credited');
        } else if (res.data.status === 'pending') {
          setTrackStatus('pending');
        } else {
          setTrackStatus('queued');
        }
        void vault.refetchAll();
        void queryClient.invalidateQueries({ queryKey: ['wallet'] });
        vault.resetDepositFlow();
        setAmount('');
      })
      .catch((err: unknown) => {
        setTrackStatus('error');
        if (isAxiosError(err)) {
          const body = err.response?.data as { error?: { details?: { reason?: string }; message?: string }; message?: string } | undefined;
          const reason = body?.error?.details?.reason;
          setTrackError(depositTrackReasonMessage(reason, t));
        } else {
          setTrackError(t('wallet.deposit.trackFailed'));
        }
      });
  }, [vault.isDepositSuccess, vault.depositTxHash, vault, queryClient, t]);

  const parsed = Number(amount);
  const busy =
    vault.depositStep !== 'idle' ||
    vault.isDepositConfirming ||
    trackStatus === 'tracking';

  const hashValid = TX_HASH_RE.test(normalizeTxHash(manualHash));

  async function handleManualTrack() {
    const hash = normalizeTxHash(manualHash);
    if (!hashValid) return;

    setTrackStatus('tracking');
    setTrackError('');
    try {
      const { data } = await apiClient.post<TrackDepositResponseDTO>('/api/wallet/deposits/track', { txHash: hash });
      if (data.status === 'already_credited' || data.status === 'credited') {
        setTrackStatus('credited');
      } else if (data.status === 'pending') {
        setTrackStatus('pending');
      } else if (data.status === 'rejected') {
        setTrackStatus('error');
        setTrackError(depositTrackReasonMessage(data.reason, t));
      } else {
        setTrackStatus('queued');
      }
      setManualHash('');
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void vault.refetchAll();
    } catch (err: unknown) {
      setTrackStatus('error');
      if (isAxiosError(err)) {
        const body = err.response?.data as { error?: { code?: string; details?: { reason?: string } } } | undefined;
        const code = body?.error?.code;
        if (code === 'AUTH_WALLET_NOT_LINKED') {
          setTrackError(t('wallet.deposit.trackFailed'));
        } else {
          setTrackError(depositTrackReasonMessage(body?.error?.details?.reason, t));
        }
      } else {
        setTrackError(t('wallet.deposit.trackFailed'));
      }
    }
  }

  async function handleDeposit() {
    setTrackStatus('idle');
    setTrackError('');
    trackedHashRef.current = null;
    try {
      await vault.transferDeposit(amount);
    } catch {
      // depositError shown below
    }
  }

  async function copyTreasury() {
    if (!treasuryAddress) return;
    await navigator.clipboard.writeText(treasuryAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-8">
      <WalletMinAmountCallout
        badgeLabel={t('wallet.deposit.minBadge', { amount: minDeposit })}
        hintLabel={t('wallet.deposit.minHint')}
      />

      {/* ——— Fluxo principal: MetaMask ——— */}
      <section
        className="pixel-box-light space-y-4 p-4 sm:p-5"
        style={{ borderColor: 'var(--green)' }}
      >
        <div>
          <p className="ui-label-sm font-bold" style={{ color: 'var(--green)' }}>
            {t('wallet.deposit.metamaskTitle')}
          </p>
          <p className="retro-text mt-1 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('wallet.deposit.metamaskHint')}
          </p>
        </div>

        {!linkedWallet ? (
          <div className="space-y-3">
            <div className="pixel-box-light px-4 py-3" style={{ borderColor: 'var(--orange)' }}>
              <p className="retro-text text-sm font-bold" style={{ color: 'var(--orange)' }}>
                {t('wallet.deposit.connectFirst')}
              </p>
              <p className="retro-text mt-1 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
                {t('wallet.deposit.connectFirstHint')}
              </p>
            </div>
            <WalletPanel compact />
          </div>
        ) : !vault.isConfigured ? (
          <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('wallet.deposit.notConfigured')}
          </p>
        ) : vault.wrongAccount ? (
          <p className="retro-text text-sm sm:text-base" style={{ color: 'var(--orange)' }}>
            {t('wallet.deposit.wrongAccount')}
          </p>
        ) : (
          <>
            <div
              className="pixel-box-light flex items-center gap-2 px-4 py-2"
              style={{ borderColor: 'var(--green)' }}
            >
              <i className="bi bi-check-lg" aria-hidden />
              <p className="retro-text text-sm" style={{ color: 'var(--green)' }}>
                {t('wallet.deposit.linkedAs')}{' '}
                <span className="font-mono font-bold">{formatWalletAddress(linkedWallet)}</span>
              </p>
            </div>

            <div className="pixel-box-light px-4 py-3" style={{ borderColor: 'var(--blue)' }}>
              <p className="ui-label-sm mb-1" style={{ color: 'var(--text-muted)' }}>
                {t('wallet.deposit.walletBalance')}
              </p>
              <p className="retro-text text-base font-bold" style={{ color: 'var(--blue)' }}>
                {vault.walletUsdcBalance.toLocaleString()} USDC
              </p>
            </div>

            <label className="block">
              <span className="ui-label-sm mb-2 block" style={{ color: 'var(--text-muted)' }}>
                {t('wallet.deposit.amountLabel')}
              </span>
              <input
                type="number"
                min={vault.minDeposit}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pixel-input w-full"
                placeholder="0.00"
              />
            </label>

            <button
              type="button"
              onClick={() => void handleDeposit()}
              disabled={busy || !parsed || parsed < vault.minDeposit}
              className="pixel-btn pixel-btn-green pixel-btn-md w-full"
            >
              {busy ? t('wallet.tx.pending') : t('wallet.deposit.submit')}
            </button>

            {vault.depositTxHash && (
              <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('wallet.tx.hash')}:{' '}
                <a
                  href={getExplorerTxUrl(vault.depositTxHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {vault.depositTxHash.slice(0, 10)}...
                </a>
              </p>
            )}

            {vault.depositError && (
              <p className="retro-text text-sm" style={{ color: 'var(--orange)' }}>
                {t('wallet.deposit.txRejected')}
              </p>
            )}
          </>
        )}
      </section>

      {/* ——— Fallback: depósito manual (sem MetaMask) ——— */}
      <section
        className="pixel-box-light space-y-4 p-4 sm:p-5"
        style={{ borderColor: 'var(--gold)' }}
      >
        <div>
          <p className="ui-label-sm font-bold" style={{ color: 'var(--gold)' }}>
            {t('wallet.deposit.manualTitle')}
          </p>
          <p className="retro-text mt-1 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('wallet.deposit.manualFallbackHint')}
          </p>
        </div>

        {treasuryAddress ? (
          <>
            <div className="pixel-box-light space-y-2 px-4 py-3" style={{ borderColor: 'var(--gold)' }}>
              <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
                {t('wallet.deposit.treasuryLabel')}
              </p>
              <p className="retro-text break-all font-mono text-sm" style={{ color: 'var(--gold)' }}>
                {treasuryAddress}
              </p>
              <button type="button" onClick={() => void copyTreasury()} className="pixel-btn pixel-btn-sm">
                {copied ? t('wallet.deposit.copied') : t('wallet.deposit.copy')}
              </button>
              <p className="retro-text text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
                {linkedWallet
                  ? t('wallet.deposit.manualHintLinkedOptional', {
                      wallet: formatWalletAddress(linkedWallet),
                    })
                  : t('wallet.deposit.manualHintUnlinked')}
              </p>
            </div>

            <label className="block">
              <span className="ui-label-sm mb-2 block" style={{ color: 'var(--text-muted)' }}>
                {t('wallet.deposit.txHashLabel')}
              </span>
              <input
                type="text"
                value={manualHash}
                onChange={(e) => {
                  setManualHash(e.target.value);
                  if (trackError) setTrackError('');
                }}
                onBlur={() => {
                  const normalized = normalizeTxHash(manualHash);
                  if (TX_HASH_RE.test(normalized)) setManualHash(normalized);
                }}
                className="pixel-input w-full font-mono text-sm sm:text-base"
                placeholder="0x..."
                spellCheck={false}
                autoComplete="off"
                inputMode="text"
              />
            </label>

            {manualHash.trim().length > 0 && !hashValid && (
              <p className="retro-text text-sm" style={{ color: 'var(--orange)' }}>
                {t('wallet.deposit.hashInvalid')}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleManualTrack()}
              disabled={trackStatus === 'tracking' || !hashValid}
              className="pixel-btn pixel-btn-md w-full"
              style={{ background: 'var(--gold)', color: 'var(--bg-dark)' }}
            >
              {trackStatus === 'tracking' ? t('wallet.tx.pending') : t('wallet.deposit.confirmManual')}
            </button>

            <TrackStatusMessages trackStatus={trackStatus} trackError={trackError} t={t} />
          </>
        ) : (
          <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('wallet.deposit.notConfigured')}
          </p>
        )}
      </section>
    </div>
  );
}
