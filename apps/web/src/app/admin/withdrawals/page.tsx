import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WithdrawalRequestDTO } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import {
  AdminBadge,
  AdminButton,
  AdminModal,
  AdminPageHeader,
  AdminTable,
} from '../../../components/admin/AdminTable';
import { adminPt, withdrawalStatusLabel } from '../../../lib/admin/i18n';
import { Web3Provider } from '../../../lib/web3/Web3Provider';
import { useAdminUsdtPayout } from '../../../hooks/useAdminUsdtPayout';
import { getUsdcAddress, getUsdtAddress } from '../../../lib/web3/config';

const statusVariant: Record<string, 'warning' | 'success' | 'danger' | 'default' | 'info'> = {
  pending: 'warning',
  approved: 'info',
  completed: 'success',
  rejected: 'danger',
  failed: 'danger',
};

const statusOptions = ['pending', 'completed', 'rejected'] as const;

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function buildSendSummary(row: WithdrawalRequestDTO, tokenContract: string) {
  const currency = (row.currency ?? 'usdt').toUpperCase();
  return [
    'Rede: Polygon (137)',
    `Token: ${currency}${currency === 'USDT' ? ' (Tether)' : ' nativo (Circle)'}`,
    `Contrato: ${tokenContract}`,
    `Destino: ${row.wallet}`,
    `Valor: ${row.amountUsdc} ${currency}`,
  ].join('\n');
}

function SendSlipRow({
  label,
  value,
  mono,
  large,
}: {
  label: string;
  value: string;
  mono?: boolean;
  large?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1 flex items-start gap-2">
        <p
          className={`min-w-0 break-all text-slate-100 ${mono ? 'font-mono text-xs text-sky-300' : ''} ${
            large ? 'text-2xl font-bold text-emerald-300' : 'text-sm'
          }`}
        >
          {value}
        </p>
        <button
          type="button"
          title="Copiar"
          onClick={() => copyText(value)}
          className="shrink-0 text-slate-500 hover:text-white"
        >
          <i className="bi bi-clipboard text-xs" />
        </button>
      </div>
    </div>
  );
}

function WithdrawalSendSlip({
  row,
  usdtContract,
  usdcContract,
}: {
  row: WithdrawalRequestDTO;
  usdtContract: string;
  usdcContract: string;
}) {
  const t = adminPt.withdrawals;
  const isLegacyUsdc = (row.currency ?? 'usdt') !== 'usdt';
  const currency = isLegacyUsdc ? 'USDC' : 'USDT';
  const tokenContract = isLegacyUsdc ? usdcContract : usdtContract;
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-amber-200">{t.sendSlipTitle}</p>
        <button
          type="button"
          onClick={() => copyText(buildSendSummary(row, tokenContract))}
          className="text-xs text-amber-300/80 hover:text-amber-200 underline-offset-2 hover:underline"
        >
          {t.copyAll}
        </button>
      </div>
      {isLegacyUsdc && (
        <p className="text-xs font-semibold text-amber-300">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden /> Saque legado — pagar em USDC (não USDT), padrão anterior a 01/08/2026.
        </p>
      )}
      <SendSlipRow label={t.sendNetwork} value={t.sendNetworkValue} />
      <SendSlipRow label={t.sendToken} value={isLegacyUsdc ? 'USDC nativo (Circle) — não use USDC.e' : t.sendTokenValue} />
      <SendSlipRow label={t.sendContract} value={tokenContract} mono />
      <SendSlipRow label={t.sendTo} value={row.wallet} mono />
      <SendSlipRow label={t.sendAmount} value={`${row.amountUsdc} ${currency}`} large />
      {row.feeUsdc > 0 && (
        <p className="text-[10px] text-slate-500">
          {t.debitedLabel}: {row.requestedUsdc} {currency} ({t.feeLabel} {row.feeUsdc})
        </p>
      )}
    </div>
  );
}

function AdminWithdrawalsInner() {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState<WithdrawalRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveModal, setApproveModal] = useState<WithdrawalRequestDTO | null>(null);
  const [sendInfoModal, setSendInfoModal] = useState<WithdrawalRequestDTO | null>(null);
  const [approveTxHash, setApproveTxHash] = useState('');
  const [rejectModal, setRejectModal] = useState<WithdrawalRequestDTO | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const [treasuryUsdt, setTreasuryUsdt] = useState<string | null>(null);
  const [treasuryConfigured, setTreasuryConfigured] = useState<boolean | null>(null);
  const [treasuryError, setTreasuryError] = useState('');
  const t = adminPt.withdrawals;
  const usdtContract = getUsdtAddress() ?? '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
  const usdcContract = getUsdcAddress() ?? '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359';

  const payout = useAdminUsdtPayout();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminClient.get<{ items: WithdrawalRequestDTO[] }>('/withdrawals', {
        params: { status, limit: 50 },
      });
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, [status]);

  const loadTreasury = useCallback(async () => {
    try {
      const { data } = await adminClient.get<{ configured: boolean; usdt: string | null; error?: string }>(
        '/withdrawals/satspay-balance',
      );
      setTreasuryConfigured(data.configured);
      setTreasuryUsdt(data.usdt);
      setTreasuryError(data.error ?? '');
    } catch {
      setTreasuryConfigured(false);
      setTreasuryUsdt(null);
      setTreasuryError('SEND_FAILED');
    }
  }, []);

  useEffect(() => {
    void load();
    void loadTreasury();
  }, [load, loadTreasury]);

  async function payWithWallet(row: WithdrawalRequestDTO) {
    if ((row.currency ?? 'usdt') !== 'usdt') {
      setMessageError(true);
      setMessage('Saque legado em USDC — pague manualmente (este botão só envia USDT).');
      setSendInfoModal(row);
      return;
    }
    setMessage('');
    setMessageError(false);
    setBusyId(row.id);
    payout.setStep('connecting');
    try {
      const hash = await payout.payWithdrawal(row.wallet, row.amountUsdc);
      payout.setStep('approving');
      await adminClient.post(`/withdrawals/${row.id}/approve`, {
        txHash: hash,
        paymentMethod: 'metamask',
      });
      payout.setStep('done');
      setMessage(t.approveSuccess);
      await load();
      payout.reset();
    } catch (err) {
      setMessageError(true);
      const msg =
        err instanceof Error && err.message
          ? err.message
          : payout.errorMessage || t.payoutFailed;
      setMessage(msg);
      if (/saldo usd[ct]|insufficient/i.test(msg)) {
        setSendInfoModal(row);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function sendViaSatspay(row: WithdrawalRequestDTO) {
    setMessage('');
    setMessageError(false);
    setBusyId(row.id);
    try {
      await adminClient.post(`/withdrawals/${row.id}/satspay-send`);
      setMessage(`USDT enviado para ${row.satspayEmail}.`);
      await load();
      await loadTreasury();
    } catch (err) {
      setMessageError(true);
      const details = (err as { response?: { data?: { error?: { details?: { satspayCode?: string; message?: string } } } } })
        .response?.data?.error?.details;
      const code = details?.satspayCode;
      setMessage(code ? `SatsPay recusou: ${code}${details?.message ? ` — ${details.message}` : ''}` : t.approveFailed);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function confirmApprove() {
    if (!approveModal) return;
    setBusy(true);
    setMessage('');
    setMessageError(false);
    try {
      await adminClient.post(`/withdrawals/${approveModal.id}/approve`, {
        txHash: approveTxHash.trim() || null,
        paymentMethod: 'manual',
      });
      setApproveModal(null);
      setApproveTxHash('');
      setMessage(t.approveSuccess);
      await load();
    } catch {
      setMessageError(true);
      setMessage(t.approveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!rejectModal || rejectReason.length < 3) return;
    setBusy(true);
    try {
      await adminClient.post(`/withdrawals/${rejectModal.id}/reject`, { reason: rejectReason });
      setRejectModal(null);
      setRejectReason('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = status === 'pending' ? items.length : null;
  const rowBusy = busyId != null;
  const payoutLabel =
    payout.step === 'connecting'
      ? t.connectingWallet
      : payout.step === 'confirming'
        ? t.confirmingTx
        : payout.step === 'approving'
          ? t.approvingGame
          : t.paying;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Link
            to="/admin/withdrawals/history"
            className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]"
          >
            Histórico completo
          </Link>
        }
      />

      <div className="admin-card border border-emerald-500/25 bg-emerald-500/5 px-5 py-4 space-y-1">
        <p className="text-sm font-semibold text-emerald-200">Tesouraria SatsPay (USDT)</p>
        <p className="text-lg font-bold text-emerald-300">
          {treasuryConfigured === false
            ? 'Chave não configurada'
            : treasuryUsdt != null
              ? `${treasuryUsdt} USDT`
              : treasuryError
                ? `Indisponível (${treasuryError})`
                : '…'}
        </p>
        <p className="text-xs text-slate-400">
          O envio só acontece no botão Aprovar e enviar. Sem saldo ou com recusa, o pedido continua pendente.
        </p>
      </div>

      <div className="admin-card border border-sky-500/20 bg-sky-500/5 px-5 py-4 space-y-2">
        <p className="text-sm font-semibold text-sky-200">{t.manualTitle}</p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-slate-400">
          <li>{t.manualStep1}</li>
          <li>{t.manualStep2}</li>
          <li>{t.manualStep3}</li>
        </ol>
      </div>

      <div
        className={`admin-card flex flex-wrap items-center justify-between gap-3 px-4 py-4 ${
          payout.walletReady
            ? 'border border-white/[0.06]'
            : 'border border-amber-500/35 bg-amber-500/5'
        }`}
      >
        <div className="min-w-0 space-y-0.5">
          {payout.walletReady && payout.activeAddress ? (
            <>
              <p className="text-xs text-slate-400">{t.walletConnected}</p>
              <p className="font-mono text-sm text-sky-300">{shortAddr(payout.activeAddress)}</p>
              <p className="text-xs text-slate-500">
                {t.adminUsdcBalance}:{' '}
                <span className="font-semibold text-emerald-300">
                  {payout.nativeBalance.toFixed(4)} USDT
                </span>
                <span className="text-slate-600"> · {payout.networkLabel}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-amber-200">1º passo: conectar a carteira</p>
              <p className="text-sm text-slate-400">
                Conecte a MetaMask da tesouraria MLL (Polygon). Sem isso o botão Pagar não assina a
                tx.
              </p>
            </>
          )}
        </div>
        <AdminButton
          size="sm"
          variant={payout.walletReady ? 'ghost' : 'secondary'}
          disabled={payout.busy}
          onClick={() => {
            setMessage('');
            setMessageError(false);
            void payout
              .connectWallet()
              .then(() => {
                setMessage('MetaMask conectada.');
                setMessageError(false);
              })
              .catch((err: unknown) => {
                setMessageError(true);
                setMessage(
                  err instanceof Error && err.message
                    ? err.message
                    : 'Falha ao conectar MetaMask.',
                );
              });
          }}
        >
          <i className="bi bi-wallet2 text-xs" />{' '}
          {payout.busy && payout.step === 'connecting'
            ? t.connectingWallet
            : payout.walletReady
              ? 'Trocar carteira'
              : t.connectWallet}
        </AdminButton>
      </div>

      {message && (
        <p
          className={`rounded-xl border px-4 py-2.5 text-sm ${
            messageError
              ? 'border-red-500/25 bg-red-500/10 text-red-300'
              : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {withdrawalStatusLabel(s)}
            </option>
          ))}
        </select>
        {pendingCount != null && pendingCount > 0 && (
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
            {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <AdminTable
        loading={loading}
        rows={items}
        rowKey={(r) => r.id}
        columns={[
          {
            key: 'user',
            header: adminPt.user,
            render: (r) => (
              <div className="min-w-0">
                <p className="font-medium text-slate-200">{r.username ?? '—'}</p>
                {r.email && <p className="text-[10px] text-slate-500 truncate">{r.email}</p>}
              </div>
            ),
          },
          {
            key: 'wallet',
            header: adminPt.wallet,
            render: (r) => (
              <div className="min-w-0 space-y-1">
                {r.satspayEmail ? (
                  <p className="text-xs text-emerald-300 break-all">{r.satspayEmail}</p>
                ) : (
                  <code className="text-xs text-sky-300">{r.wallet}</code>
                )}
                {r.satspayError && (
                  <p className="text-[10px] text-red-300">SatsPay: {r.satspayError}</p>
                )}
                <button
                  type="button"
                  title="Copiar"
                  onClick={() => copyText(r.satspayEmail ?? r.wallet)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <i className="bi bi-clipboard text-xs" />
                </button>
              </div>
            ),
          },
          {
            key: 'amount',
            header: t.payoutColumn,
            render: (r) => (
              <div>
                <p className="font-semibold text-emerald-300">
                  {r.amountUsdc} {(r.currency ?? 'usdt').toUpperCase()}
                </p>
                {r.feeUsdc > 0 && (
                  <p className="text-[10px] text-slate-500">
                    {t.debitedLabel}: {r.requestedUsdc} {(r.currency ?? 'usdt').toUpperCase()} ({t.feeLabel} {r.feeUsdc})
                  </p>
                )}
              </div>
            ),
          },
          {
            key: 'status',
            header: adminPt.status,
            render: (r) => (
              <AdminBadge variant={statusVariant[r.status] ?? 'default'}>
                {withdrawalStatusLabel(r.status)}
              </AdminBadge>
            ),
          },
          {
            key: 'actions',
            header: adminPt.actions,
            render: (r) =>
              r.status === 'pending' || r.status === 'sending' ? (
                <div className="flex flex-wrap gap-2">
                  {r.satspayEmail ? (
                    <AdminButton
                      size="sm"
                      variant="secondary"
                      disabled={rowBusy}
                      onClick={() => void sendViaSatspay(r)}
                    >
                      {busyId === r.id ? 'Enviando…' : 'Aprovar e enviar'}
                    </AdminButton>
                  ) : (
                    <>
                      <AdminButton
                        size="sm"
                        variant="secondary"
                        disabled={rowBusy || !payout.isConfigured}
                        onClick={() => void payWithWallet(r)}
                      >
                        <i className="bi bi-lightning-charge-fill text-xs" />{' '}
                        {busyId === r.id ? payoutLabel : t.payWithWallet}
                      </AdminButton>
                      <AdminButton
                        size="sm"
                        variant="ghost"
                        disabled={rowBusy}
                        onClick={() => setSendInfoModal(r)}
                      >
                        {t.viewSendInfo}
                      </AdminButton>
                      <AdminButton
                        size="sm"
                        variant="ghost"
                        disabled={rowBusy}
                        onClick={() => {
                          setApproveModal(r);
                          setApproveTxHash('');
                        }}
                      >
                        {t.markPaid}
                      </AdminButton>
                    </>
                  )}
                  <AdminButton
                    size="sm"
                    variant="danger"
                    disabled={rowBusy || r.status === 'sending'}
                    onClick={() => setRejectModal(r)}
                  >
                    {adminPt.reject}
                  </AdminButton>
                </div>
              ) : r.txHash?.startsWith('0x') ? (
                <a
                  href={`https://polygonscan.com/tx/${r.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-sky-400 hover:underline font-mono"
                >
                  {r.txHash.slice(0, 12)}…
                </a>
              ) : r.txHash ? (
                <span className="font-mono text-xs text-emerald-300">{r.txHash.slice(0, 12)}…</span>
              ) : null,
          },
        ]}
      />

      <AdminModal
        open={!!sendInfoModal}
        title={t.sendSlipTitle}
        onClose={() => setSendInfoModal(null)}
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setSendInfoModal(null)}>
              {adminPt.cancel}
            </AdminButton>
            {sendInfoModal && (
              <AdminButton
                variant="secondary"
                onClick={() => {
                  setApproveModal(sendInfoModal);
                  setApproveTxHash('');
                  setSendInfoModal(null);
                }}
              >
                {t.markPaid}
              </AdminButton>
            )}
          </>
        }
      >
        {sendInfoModal && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-400">
              A MetaMask só abre o envio se a carteira conectada tiver USDT. Sem saldo, envie
              manualmente com estes dados:
            </p>
            <WithdrawalSendSlip row={sendInfoModal} usdtContract={usdtContract} usdcContract={usdcContract} />
          </div>
        )}
      </AdminModal>

      <AdminModal
        open={!!approveModal}
        title={t.approveModalTitle}
        onClose={() => !busy && setApproveModal(null)}
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setApproveModal(null)} disabled={busy}>
              {adminPt.cancel}
            </AdminButton>
            <AdminButton variant="secondary" onClick={() => void confirmApprove()} disabled={busy}>
              {busy ? adminPt.saving : t.confirmMarkPaid}
            </AdminButton>
          </>
        }
      >
        {approveModal && (
          <div className="space-y-4 text-sm">
            <p className="text-slate-400">{t.approveModalHint}</p>
            <WithdrawalSendSlip row={approveModal} usdtContract={usdtContract} usdcContract={usdcContract} />
            <label className="block space-y-2">
              <span className="text-slate-400">{t.txHashOptional}</span>
              <input
                value={approveTxHash}
                onChange={(e) => setApproveTxHash(e.target.value)}
                placeholder="0x… (opcional)"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-mono text-slate-100"
              />
            </label>
          </div>
        )}
      </AdminModal>

      <AdminModal
        open={!!rejectModal}
        title={t.rejectTitle}
        onClose={() => setRejectModal(null)}
        footer={
          <AdminButton
            variant="danger"
            onClick={() => void reject()}
            disabled={busy || rejectReason.length < 3}
          >
            {adminPt.reject}
          </AdminButton>
        }
      >
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
          placeholder={adminPt.reason}
        />
      </AdminModal>
    </div>
  );
}

export function AdminWithdrawalsPage() {
  return (
    <Web3Provider>
      <AdminWithdrawalsInner />
    </Web3Provider>
  );
}
