import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api/client';
import type { WithdrawalRequestDTO } from '@mll/shared';
import { calcWithdrawAmounts } from '@mll/shared';
import { WalletMinAmountCallout } from './WalletMinAmountCallout';
import { getExplorerTxUrl } from '../../lib/web3/chains';
import { formatStableAmount } from '../../lib/formatUsdc';

interface WalletWithdrawFormProps {
  linkedWallet: string | null | undefined;
  vaultBalance: number;
  minWithdraw: number;
  withdrawFeePct: number;
  withdrawalsPaused: boolean;
}

function statusLabel(status: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (status === 'pending') return t('wallet.withdraw.pending', { defaultValue: 'Pendente' });
  if (status === 'completed') return t('wallet.withdraw.paid', { defaultValue: 'Pago' });
  if (status === 'rejected') return t('wallet.withdraw.rejected', { defaultValue: 'Rejeitado' });
  if (status === 'cancelled') return t('wallet.withdraw.cancelled', { defaultValue: 'Cancelado' });
  return status;
}

function statusColor(status: string): string {
  if (status === 'pending') return 'var(--orange)';
  if (status === 'completed') return 'var(--green)';
  if (status === 'rejected') return 'var(--red)';
  return 'var(--text-muted)';
}

function shortHash(h: string): string {
  if (h.length < 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

export function WalletWithdrawForm({
  linkedWallet,
  vaultBalance,
  minWithdraw,
  withdrawFeePct,
  withdrawalsPaused,
}: WalletWithdrawFormProps) {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [satspayEmail, setSatspayEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requests, setRequests] = useState<WithdrawalRequestDTO[]>([]);

  useEffect(() => {
    if (!linkedWallet) return;
    void apiClient
      .get<{ requests: WithdrawalRequestDTO[] }>('/api/wallet/withdraw-requests')
      .then((res) => setRequests(res.data.requests))
      .catch(() => {});
  }, [linkedWallet, success]);

  if (!linkedWallet) {
    return (
      <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('wallet.withdraw.linkRequired')}
      </p>
    );
  }

  if (withdrawalsPaused) {
    return (
      <p className="retro-text text-sm" style={{ color: 'var(--orange)' }}>
        {t('wallet.withdraw.paused', { defaultValue: 'Withdrawals are temporarily paused.' })}
      </p>
    );
  }

  const parsed = Number(amount);
  const email = satspayEmail.trim().toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const feePreview = parsed > 0 ? calcWithdrawAmounts(parsed, withdrawFeePct) : null;
  const pendingTotal = requests
    .filter((r) => r.status === 'pending')
    .reduce((s, r) => s + (r.requestedUsdc ?? r.amountUsdc), 0);
  const available = vaultBalance - pendingTotal;

  async function submit() {
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      await apiClient.post('/api/wallet/withdraw-requests', { amountUsdc: parsed, satspayEmail: email });
      setSuccess(t('wallet.withdraw.requestSubmitted'));
      setAmount('');
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    } catch {
      setError(t('wallet.withdraw.requestFailed', { defaultValue: 'Request failed.' }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <WalletMinAmountCallout
        badgeLabel={t('wallet.withdraw.minBadge', { amount: minWithdraw })}
        hintLabel={t('wallet.withdraw.minHint')}
        accent="green"
      />

      {withdrawFeePct > 0 && (
        <p className="retro-text text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('wallet.withdraw.feeHint', {
            pct: (withdrawFeePct * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }),
          })}
        </p>
      )}

      <div className="pixel-box-light px-4 py-3 sm:px-5 sm:py-4" style={{ borderColor: 'var(--blue)' }}>
        <p className="retro-text text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
          <i className="bi bi-hourglass-split" aria-hidden /> {t('wallet.withdraw.manualNote')}
        </p>
      </div>

      <div className="pixel-box-light px-4 py-3" style={{ borderColor: 'var(--green)' }}>
        <p className="ui-label-sm mb-1" style={{ color: 'var(--text-muted)' }}>
          {t('wallet.withdraw.vaultBalance')}
        </p>
        <p className="retro-text text-base font-bold" style={{ color: 'var(--green)' }}>
          {formatStableAmount(vaultBalance)} USDT
        </p>
        {pendingTotal > 0 && (
          <p className="retro-text mt-1 text-sm" style={{ color: 'var(--orange)' }}>
            {t('wallet.withdraw.pending', { defaultValue: 'Pending' })}: {pendingTotal} USDT
          </p>
        )}
      </div>

      <label className="block">
        <span className="ui-label-sm mb-2 block" style={{ color: 'var(--text-muted)' }}>
          {t('wallet.withdraw.satspayEmailLabel', { defaultValue: 'E-mail da conta SatsPay' })}
        </span>
        <input
          type="email"
          autoComplete="email"
          value={satspayEmail}
          onChange={(e) => setSatspayEmail(e.target.value)}
          className="pixel-input w-full"
          placeholder="jogador@email.com"
        />
        <p className="retro-text mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('wallet.withdraw.satspayEmailHint', { defaultValue: 'É o e-mail da conta que recebe. Nada é enviado agora.' })}
        </p>
      </label>

      <label className="block">
        <span className="ui-label-sm mb-2 block" style={{ color: 'var(--text-muted)' }}>
          {t('wallet.withdraw.amountLabel')}
        </span>
        <input
          type="number"
          min={minWithdraw}
          step="0.01"
          max={available}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="pixel-input w-full"
          placeholder="0.00"
        />
      </label>

      {feePreview && feePreview.fee > 0 && (
        <div className="pixel-box-light px-3 py-2 text-xs space-y-1" style={{ borderColor: 'var(--bg-lighter)' }}>
          <p className="retro-text" style={{ color: 'var(--text-secondary)' }}>
            {t('wallet.withdraw.feeAmount', { fee: feePreview.fee.toLocaleString(undefined, { maximumFractionDigits: 6 }) })}
          </p>
          <p className="retro-text font-bold" style={{ color: 'var(--green)' }}>
            {t('wallet.withdraw.netAmount', { net: feePreview.net.toLocaleString(undefined, { maximumFractionDigits: 6 }) })}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || !emailOk || !parsed || parsed < minWithdraw || parsed > available}
        className="pixel-btn pixel-btn-red pixel-btn-md w-full"
      >
        {busy ? t('wallet.tx.pending') : t('wallet.withdraw.submitRequest', { defaultValue: 'Request withdrawal' })}
      </button>

      {error && (
        <p className="retro-text text-xs" style={{ color: 'var(--orange)' }}>
          {error}
        </p>
      )}
      {success && (
        <p className="retro-text text-xs" style={{ color: 'var(--green)' }}>
          {success}
        </p>
      )}

      <div className="space-y-3 pt-2">
        <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
          {t('wallet.withdraw.historyTitle', { defaultValue: 'Histórico de Saques' })}
        </p>
        {requests.length === 0 ? (
          <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('wallet.withdraw.historyEmpty', { defaultValue: 'Nenhum saque ainda.' })}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" style={{ minWidth: 760 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="px-2 py-2 font-normal">Data</th>
                  <th className="px-2 py-2 font-normal">Valor</th>
                  <th className="px-2 py-2 font-normal">Taxa</th>
                  <th className="px-2 py-2 font-normal">Recebido</th>
                  <th className="px-2 py-2 font-normal">Destino</th>
                  <th className="px-2 py-2 font-normal">Referência</th>
                  <th className="px-2 py-2 font-normal">Status</th>
                  <th className="px-2 py-2 font-normal">Ações</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--bg-lighter)' }}>
                    <td className="px-2 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(r.createdAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {formatStableAmount(r.requestedUsdc)} {r.currency?.toUpperCase() ?? 'USDT'}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {formatStableAmount(r.feeUsdc)} {r.currency?.toUpperCase() ?? 'USDT'}
                    </td>
                    <td className="px-2 py-2 font-bold whitespace-nowrap" style={{ color: 'var(--green)' }}>
                      {formatStableAmount(r.amountUsdc)} {r.currency?.toUpperCase() ?? 'USDT'}
                    </td>
                    <td className="px-2 py-2" style={{ color: 'var(--text-secondary)' }}>
                      {r.satspayEmail ?? r.wallet}
                    </td>
                    <td className="px-2 py-2 font-mono" style={{ color: 'var(--blue)' }}>
                      {r.txHash ? shortHash(r.txHash) : '—'}
                    </td>
                    <td className="px-2 py-2" style={{ color: statusColor(r.status) }}>
                      {statusLabel(r.status, t)}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        {r.txHash?.startsWith('0x') && (
                          <a
                            href={getExplorerTxUrl(r.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="pixel-btn pixel-btn-sm"
                            style={{ fontSize: 10 }}
                          >
                            PolygonScan
                          </a>
                        )}
                        {r.txHash && (
                          <button
                            type="button"
                            className="pixel-btn pixel-btn-sm"
                            style={{ fontSize: 10 }}
                            onClick={() => copyText(r.txHash!)}
                          >
                            Hash
                          </button>
                        )}
                        <button
                          type="button"
                          className="pixel-btn pixel-btn-sm"
                          style={{ fontSize: 10 }}
                          onClick={() => copyText(r.satspayEmail ?? r.wallet)}
                        >
                          {r.satspayEmail ? 'SatsPay' : 'Wallet'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
