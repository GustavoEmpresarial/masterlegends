import { useCallback, useEffect, useState } from 'react';
import type { OfferwallRewardDTO } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import {
  AdminBadge,
  AdminButton,
  AdminPageHeader,
  AdminTable,
} from '../../../components/admin/AdminTable';
import { formatAdminDate } from '../../../lib/admin/i18n';

function shortId(id: string) {
  return id.slice(0, 8);
}

export function AdminOfferwallPage() {
  const [rewards, setRewards] = useState<OfferwallRewardDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminClient.get<OfferwallRewardDTO[]>('/offerwall/rewards');
      setRewards(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReverse(transactionId: string) {
    if (!confirm(`Reverter recompensa ${transactionId}?`)) return;
    try {
      await adminClient.post(`/offerwall/rewards/${transactionId}/reverse`);
      setMessage(`Recompensa ${transactionId} revertida.`);
      await load();
    } catch (err: unknown) {
      setMessage(`Erro: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  const totalGmt = rewards
    .filter((r) => r.currency === 'GMT' && r.status === 'completed')
    .reduce((s, r) => s + r.amount, 0);
  const totalUsdc = rewards
    .filter((r) => r.currency === 'USDC' && r.status === 'completed')
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Offerwall Zerads"
        subtitle={`${rewards.length} recompensas · ${totalGmt.toFixed(2)} GMT · ${totalUsdc.toFixed(2)} USDC`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/25 bg-white/[0.025] p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Recompensas</p>
          <p className="text-xl font-bold text-white">{rewards.length}</p>
        </div>
        <div className="rounded-xl border border-amber-500/25 bg-white/[0.025] p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">GMT Creditado</p>
          <p className="text-xl font-bold text-amber-300">{totalGmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-xl border border-sky-500/25 bg-white/[0.025] p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">USDC Creditado</p>
          <p className="text-xl font-bold text-sky-300">{totalUsdc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <AdminTable
        loading={loading}
        rows={rewards}
        rowKey={(r) => r.transactionId}
        columns={[
          {
            key: 'user',
            header: 'Usuário',
            render: (r) => (
              <span className="text-xs font-mono text-slate-400">{shortId(r.userId)}</span>
            ),
          },
          {
            key: 'transaction',
            header: 'Transação',
            render: (r) => (
              <span className="text-xs font-mono text-sky-300">{r.transactionId.slice(0, 12)}...</span>
            ),
          },
          {
            key: 'amount',
            header: 'Valor',
            render: (r) => (
              <span className={`font-mono font-bold ${
                r.currency === 'USDC' ? 'text-sky-300' : 'text-amber-300'
              }`}>
                {r.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {r.currency}
              </span>
            ),
          },
          {
            key: 'provider',
            header: 'Provedor',
            render: (r) => (
              <AdminBadge variant="info">{r.provider}</AdminBadge>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) => (
              <AdminBadge variant={r.status === 'completed' ? 'success' : 'danger'}>
                {r.status === 'completed' ? 'Completo' : 'Revertido'}
              </AdminBadge>
            ),
          },
          {
            key: 'date',
            header: 'Data',
            render: (r) => (
              <span className="text-xs text-slate-400">{formatAdminDate(r.createdAt)}</span>
            ),
          },
          {
            key: 'actions',
            header: 'Ações',
            render: (r) =>
              r.status === 'completed' ? (
                <AdminButton
                  size="sm"
                  variant="danger"
                  onClick={() => handleReverse(r.transactionId)}
                >
                  Reverter
                </AdminButton>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
