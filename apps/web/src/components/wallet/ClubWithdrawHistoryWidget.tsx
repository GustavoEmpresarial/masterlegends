import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { WithdrawalRequestDTO } from '@mll/shared';
import { apiClient } from '../../lib/api/client';
import { getExplorerTxUrl } from '../../lib/web3/chains';

function statusLabel(status: string): string {
  if (status === 'pending') return 'Pendente';
  if (status === 'completed') return 'Pago';
  if (status === 'rejected') return 'Rejeitado';
  if (status === 'cancelled') return 'Cancelado';
  return status;
}

function statusColor(status: string): string {
  if (status === 'pending') return 'var(--orange)';
  if (status === 'completed') return 'var(--green)';
  if (status === 'rejected') return '#ff6060';
  return 'var(--text-muted)';
}

function shortHash(h: string | null): string {
  if (!h) return '—';
  if (h.length < 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-4)}`;
}

/** Compact financial history widget for Club / Index dashboard. */
export function ClubWithdrawHistoryWidget() {
  const [rows, setRows] = useState<WithdrawalRequestDTO[] | null>(null);

  useEffect(() => {
    void apiClient
      .get<{ requests: WithdrawalRequestDTO[] }>('/api/wallet/withdraw-requests')
      .then((res) => setRows(res.data.requests.slice(0, 5)))
      .catch(() => setRows([]));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="pixel-box p-4 sm:p-5"
      style={{ borderColor: 'var(--green)' }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="pixel-text text-lg sm:text-xl" style={{ color: 'var(--green)' }}>
          <i className="bi bi-cash-coin" aria-hidden /> Histórico Financeiro
        </h2>
        <Link to="/wallet?tab=withdraw" className="pixel-btn pixel-btn-sm pixel-btn-blue">
          Ver todos os saques
        </Link>
      </div>
      <p className="retro-text mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        Últimos saques
      </p>

      {rows == null ? (
        <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
          Carregando…
        </p>
      ) : rows.length === 0 ? (
        <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
          Nenhum saque ainda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm" style={{ minWidth: 360 }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="px-1 py-2 font-normal">Data</th>
                <th className="px-1 py-2 font-normal">Valor</th>
                <th className="px-1 py-2 font-normal">Status</th>
                <th className="px-1 py-2 font-normal">Hash</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--bg-lighter)' }}>
                  <td className="px-1 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(r.createdAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-1 py-2 font-bold" style={{ color: 'var(--green)' }}>
                    {r.amountUsdc.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC
                  </td>
                  <td className="px-1 py-2" style={{ color: statusColor(r.status) }}>
                    {statusLabel(r.status)}
                  </td>
                  <td className="px-1 py-2 font-mono">
                    {r.txHash ? (
                      <a
                        href={getExplorerTxUrl(r.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--blue)' }}
                      >
                        {shortHash(r.txHash)}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
