import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  WithdrawalHistoryChartsDTO,
  WithdrawalHistoryResponseDTO,
  WithdrawalHistorySummaryDTO,
  WithdrawalRequestDTO,
} from '@mll/shared';
import { adminClient } from '../../../../lib/api/adminClient';
import {
  AdminBadge,
  AdminButton,
  AdminModal,
  AdminPageHeader,
  AdminTable,
} from '../../../../components/admin/AdminTable';
import { adminPt, formatAdminDate, withdrawalStatusLabel } from '../../../../lib/admin/i18n';
import { getExplorerTxUrl } from '../../../../lib/web3/chains';

const FILTERS_KEY = 'mll_admin_wd_history_filters';

type Period = 'today' | 'yesterday' | '7d' | '30d' | 'custom' | 'all';
type StatusFilter = 'all' | 'pending' | 'completed' | 'rejected';
type OriginFilter = 'all' | 'metamask' | 'manual';

interface Filters {
  period: Period;
  status: StatusFilter;
  paymentMethod: OriginFilter;
  q: string;
  user: string;
  email: string;
  wallet: string;
  hash: string;
  minAmount: string;
  maxAmount: string;
  from: string;
  to: string;
  page: number;
  limit: number;
  sort: string;
}

const DEFAULT_FILTERS: Filters = {
  period: '30d',
  status: 'all',
  paymentMethod: 'all',
  q: '',
  user: '',
  email: '',
  wallet: '',
  hash: '',
  minAmount: '',
  maxAmount: '',
  from: '',
  to: '',
  page: 1,
  limit: 25,
  sort: 'createdAt_desc',
};

function loadFilters(): Filters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...JSON.parse(raw), page: 1 };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function statusBadge(status: string): 'warning' | 'success' | 'danger' | 'info' | 'default' {
  if (status === 'pending') return 'warning';
  if (status === 'completed') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'cancelled') return 'info';
  return 'default';
}

function statusDotColor(status: string): string {
  if (status === 'pending') return '#eab308';
  if (status === 'completed') return '#22c55e';
  if (status === 'rejected') return '#ef4444';
  if (status === 'cancelled') return '#94a3b8';
  return '#94a3b8';
}

function shortHash(h: string | null): string {
  if (!h) return '—';
  if (h.length < 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtUsdc(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

function filtersToParams(f: Filters): Record<string, string | number> {
  const p: Record<string, string | number> = {
    page: f.page,
    limit: f.limit,
    sort: f.sort,
    period: f.period,
  };
  if (f.status !== 'all') p.status = f.status;
  if (f.paymentMethod !== 'all') p.paymentMethod = f.paymentMethod;
  if (f.q.trim()) p.q = f.q.trim();
  if (f.user.trim()) p.user = f.user.trim();
  if (f.email.trim()) p.email = f.email.trim();
  if (f.wallet.trim()) p.wallet = f.wallet.trim();
  if (f.hash.trim()) p.hash = f.hash.trim();
  if (f.minAmount.trim()) p.minAmount = Number(f.minAmount);
  if (f.maxAmount.trim()) p.maxAmount = Number(f.maxAmount);
  if (f.period === 'custom') {
    if (f.from) p.from = f.from;
    if (f.to) p.to = f.to;
  }
  return p;
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: WithdrawalRequestDTO[]): string {
  const headers = [
    'Data',
    'ID',
    'Usuario',
    'Email',
    'Wallet',
    'Solicitado',
    'Taxa',
    'Enviado',
    'Hash',
    'Status',
    'ProcessadoPor',
    'Origem',
  ];
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = rows.map((r) =>
    [
      r.createdAt,
      r.id,
      r.username,
      r.email,
      r.wallet,
      r.requestedUsdc,
      r.feeUsdc,
      r.amountUsdc,
      r.txHash,
      r.status,
      r.reviewedBy,
      r.paymentMethod,
    ]
      .map(escape)
      .join(','),
  );
  return [headers.join(','), ...lines].join('\n');
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-100">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function MiniBarChart({
  title,
  rows,
  valueKey,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  valueKey?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Sem dados</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 truncate text-slate-500" title={r.label}>
                {r.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-white/[0.06]">
                <div
                  className="h-full rounded bg-emerald-500/70"
                  style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-slate-300">
                {valueKey === 'usdc' ? fmtUsdc(r.value) : r.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailDrawer({
  row,
  onClose,
}: {
  row: WithdrawalRequestDTO | null;
  onClose: () => void;
}) {
  if (!row) return null;
  const explorer = row.txHash ? getExplorerTxUrl(row.txHash) : null;
  return (
    <AdminModal
      open={!!row}
      title={`Saque ${row.id.slice(0, 8)}…`}
      onClose={onClose}
      wide
      footer={
        <AdminButton variant="secondary" onClick={onClose}>
          Fechar
        </AdminButton>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase text-slate-500">Solicitação criada</p>
            <p className="text-slate-200">{formatAdminDate(row.createdAt)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">Status</p>
            <p>
              <i className="bi bi-circle-fill" style={{ color: statusDotColor(row.status), fontSize: 8 }} aria-hidden /> {withdrawalStatusLabel(row.status)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">Usuário</p>
            <p className="text-slate-200">{row.username ?? row.userId}</p>
            <p className="text-xs text-slate-500">{row.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">Wallet</p>
            <p className="font-mono text-xs text-sky-300 break-all">{row.wallet}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">Valor bruto</p>
            <p className="text-slate-200">{fmtUsdc(row.requestedUsdc)} {(row.currency ?? 'usdt').toUpperCase()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">Taxa</p>
            <p className="text-slate-200">{fmtUsdc(row.feeUsdc)} {(row.currency ?? 'usdt').toUpperCase()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">Valor líquido</p>
            <p className="font-semibold text-emerald-300">{fmtUsdc(row.amountUsdc)} {(row.currency ?? 'usdt').toUpperCase()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">Origem</p>
            <p className="text-slate-200">
              {row.paymentMethod === 'metamask'
                ? 'MetaMask'
                : row.paymentMethod === 'manual'
                  ? 'Manual'
                  : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">
              {row.status === 'rejected' ? 'Quem rejeitou' : 'Quem processou'}
            </p>
            <p className="text-slate-200">{row.reviewedBy ?? '—'}</p>
            <p className="text-xs text-slate-500">
              {row.reviewedAt ? formatAdminDate(row.reviewedAt) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">Hash</p>
            {row.txHash ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-sky-300 break-all">{row.txHash}</span>
                <button type="button" className="text-slate-400 hover:text-white" onClick={() => copyText(row.txHash!)}>
                  <i className="bi bi-clipboard" />
                </button>
                {explorer && (
                  <a href={explorer} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline text-xs">
                    PolygonScan
                  </a>
                )}
              </div>
            ) : (
              <p className="text-slate-500">—</p>
            )}
          </div>
        </div>

        {row.adminNote && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2">
            <p className="text-[10px] uppercase text-rose-400">Motivo / nota</p>
            <p className="text-slate-200">{row.adminNote}</p>
          </div>
        )}

        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Contexto da solicitação
          </p>
          <div className="grid gap-2 sm:grid-cols-2 text-xs">
            <p>
              <span className="text-slate-500">IP: </span>
              <span className="text-slate-300">{row.requestIp ?? '—'}</span>
            </p>
            <p>
              <span className="text-slate-500">Dispositivo: </span>
              <span className="text-slate-300">{row.device ?? '—'}</span>
            </p>
            <p>
              <span className="text-slate-500">Navegador: </span>
              <span className="text-slate-300">{row.browser ?? '—'}</span>
            </p>
            <p>
              <span className="text-slate-500">SO: </span>
              <span className="text-slate-300">{row.os ?? '—'}</span>
            </p>
            <p className="sm:col-span-2 break-all">
              <span className="text-slate-500">User-Agent: </span>
              <span className="text-slate-400">{row.userAgent ?? '—'}</span>
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.08] px-3 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Timeline
          </p>
          <ol className="relative space-y-3 border-l border-white/[0.1] pl-4">
            <li>
              <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-sky-500" />
              <p className="text-slate-200">Solicitação criada</p>
              <p className="text-xs text-slate-500">{formatAdminDate(row.createdAt)}</p>
            </li>
            {row.reviewedAt && (
              <li>
                <span
                  className={`absolute -left-1.5 mt-1 h-3 w-3 rounded-full ${
                    row.status === 'completed' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
                <p className="text-slate-200">
                  {row.status === 'completed' ? 'Pago' : row.status === 'rejected' ? 'Rejeitado' : 'Processado'}
                  {row.reviewedBy ? ` por ${row.reviewedBy}` : ''}
                </p>
                <p className="text-xs text-slate-500">{formatAdminDate(row.reviewedAt)}</p>
              </li>
            )}
            {row.updatedAt && row.updatedAt !== row.createdAt && (
              <li>
                <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-slate-500" />
                <p className="text-slate-200">Última atualização</p>
                <p className="text-xs text-slate-500">{formatAdminDate(row.updatedAt)}</p>
              </li>
            )}
          </ol>
        </div>
      </div>
    </AdminModal>
  );
}

export function AdminWithdrawalsHistoryPage() {
  const [filters, setFilters] = useState<Filters>(() => loadFilters());
  const [data, setData] = useState<WithdrawalHistoryResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<WithdrawalRequestDTO | null>(null);
  const [debounceQ, setDebounceQ] = useState(filters.q);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setFilters((f) => ({ ...f, q: debounceQ, page: 1 }));
    }, 350);
    return () => window.clearTimeout(t);
  }, [debounceQ]);

  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({ ...filters, page: 1 }));
    } catch {
      /* ignore */
    }
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminClient.get<WithdrawalHistoryResponseDTO>('/withdrawals/history', {
        params: filtersToParams(filters),
      });
      setData(res.data);
    } catch {
      setError('Falha ao carregar histórico de saques.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const summary: WithdrawalHistorySummaryDTO | null = data?.summary ?? null;
  const charts: WithdrawalHistoryChartsDTO | null = data?.charts ?? null;

  const columns = useMemo(
    () => [
      {
        key: 'when',
        header: 'Data/Hora',
        render: (r: WithdrawalRequestDTO) => (
          <span className="whitespace-nowrap text-xs text-slate-300">{formatAdminDate(r.createdAt)}</span>
        ),
      },
      {
        key: 'id',
        header: 'ID',
        render: (r: WithdrawalRequestDTO) => (
          <button
            type="button"
            className="font-mono text-[11px] text-sky-400 hover:underline"
            onClick={() => setSelected(r)}
          >
            {r.id.slice(0, 8)}…
          </button>
        ),
      },
      {
        key: 'user',
        header: 'Usuário',
        render: (r: WithdrawalRequestDTO) => (
          <div>
            <p className="text-slate-200">{r.username ?? '—'}</p>
            <p className="text-[11px] text-slate-500">{r.email ?? '—'}</p>
          </div>
        ),
      },
      {
        key: 'wallet',
        header: 'Wallet',
        render: (r: WithdrawalRequestDTO) => (
          <button
            type="button"
            title={r.wallet}
            className="font-mono text-[11px] text-slate-400 hover:text-white"
            onClick={() => copyText(r.wallet)}
          >
            {shortAddr(r.wallet)}
          </button>
        ),
      },
      {
        key: 'req',
        header: 'Solicitado',
        render: (r: WithdrawalRequestDTO) => fmtUsdc(r.requestedUsdc),
      },
      {
        key: 'fee',
        header: 'Taxa',
        render: (r: WithdrawalRequestDTO) => fmtUsdc(r.feeUsdc),
      },
      {
        key: 'net',
        header: 'Enviado',
        render: (r: WithdrawalRequestDTO) => (
          <span className="font-medium text-emerald-300">{fmtUsdc(r.amountUsdc)}</span>
        ),
      },
      {
        key: 'hash',
        header: 'Hash',
        render: (r: WithdrawalRequestDTO) =>
          r.txHash ? (
            <a
              href={getExplorerTxUrl(r.txHash)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] text-sky-400 hover:underline"
            >
              {shortHash(r.txHash)}
            </a>
          ) : (
            <span className="text-slate-600">—</span>
          ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (r: WithdrawalRequestDTO) => (
          <AdminBadge variant={statusBadge(r.status)}>
            <i className="bi bi-circle-fill" style={{ color: statusDotColor(r.status), fontSize: 8 }} aria-hidden /> {withdrawalStatusLabel(r.status)}
          </AdminBadge>
        ),
      },
      {
        key: 'by',
        header: 'Processado por',
        render: (r: WithdrawalRequestDTO) => (
          <span className="text-xs text-slate-400">{r.reviewedBy ?? '—'}</span>
        ),
      },
      {
        key: 'origin',
        header: 'Origem',
        render: (r: WithdrawalRequestDTO) => (
          <span className="text-xs text-slate-400">
            {r.paymentMethod === 'metamask'
              ? 'MetaMask'
              : r.paymentMethod === 'manual'
                ? 'Manual'
                : '—'}
          </span>
        ),
      },
    ],
    [],
  );

  function patch(partial: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...partial, page: partial.page ?? 1 }));
  }

  async function exportCsv() {
    try {
      const res = await adminClient.get<WithdrawalHistoryResponseDTO>('/withdrawals/history', {
        params: { ...filtersToParams({ ...filters, page: 1, limit: 100 }), limit: 100 },
      });
      downloadBlob(
        `saques-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(res.data.items),
        'text/csv;charset=utf-8',
      );
      void adminClient
        .post('/withdrawals/history/export-audit', {
          format: 'csv',
          total: res.data.items.length,
        })
        .catch(() => {});
    } catch {
      setError('Falha ao exportar CSV.');
    }
  }

  function exportExcel() {
    const rows = data?.items ?? [];
    downloadBlob(
      `saques-${new Date().toISOString().slice(0, 10)}.xls`,
      `\ufeff${toCsv(rows)}`,
      'application/vnd.ms-excel;charset=utf-8',
    );
    void adminClient
      .post('/withdrawals/history/export-audit', { format: 'excel', total: rows.length })
      .catch(() => {});
  }

  function printPdf() {
    void adminClient
      .post('/withdrawals/history/export-audit', { format: 'pdf_print', total: data?.items.length ?? 0 })
      .catch(() => {});
    window.print();
  }

  const inputClass =
    'rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-500/40 focus:outline-none';
  const selectClass = inputClass;

  return (
    <div className="space-y-6 print:space-y-3">
      <AdminPageHeader
        title="Histórico de Saques"
        subtitle="Financeiro · auditoria completa de solicitações e pagamentos"
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Link
              to="/admin/withdrawals"
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]"
            >
              Fila de pendentes
            </Link>
            <AdminButton variant="secondary" size="sm" onClick={() => void load()}>
              Atualizar
            </AdminButton>
          </div>
        }
      />

      {error && (
        <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          <SummaryCard label="Total solicitado" value={`${fmtUsdc(summary.totalRequestedUsdc)}`} />
          <SummaryCard label="Total pago" value={`${fmtUsdc(summary.totalPaidUsdc)}`} />
          <SummaryCard label="Pendente" value={`${fmtUsdc(summary.totalPendingUsdc)}`} sub={`${summary.countPending} saques`} />
          <SummaryCard label="Rejeitado" value={`${fmtUsdc(summary.totalRejectedUsdc)}`} sub={`${summary.countRejected} saques`} />
          <SummaryCard label="Quantidade" value={String(summary.count)} />
          <SummaryCard label="Ticket médio" value={fmtUsdc(summary.avgTicketUsdc)} />
          <SummaryCard
            label="Maior / menor"
            value={`${fmtUsdc(summary.maxPaidUsdc)}`}
            sub={`mín ${fmtUsdc(summary.minPaidUsdc)}`}
          />
          <SummaryCard
            label="Tempo médio"
            value={
              summary.avgProcessMinutes != null
                ? `${summary.avgProcessMinutes.toFixed(0)} min`
                : '—'
            }
          />
        </div>
      )}

      <div className="admin-card space-y-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', 'Todos'],
              ['today', 'Hoje'],
              ['yesterday', 'Ontem'],
              ['7d', '7 dias'],
              ['30d', '30 dias'],
              ['custom', 'Personalizado'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => patch({ period: key })}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                filters.period === key
                  ? 'bg-sky-500/20 text-sky-200 border border-sky-500/30'
                  : 'border border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <input
            className={inputClass}
            placeholder="Busca global (nome, email, wallet, hash, id)"
            value={debounceQ}
            onChange={(e) => setDebounceQ(e.target.value)}
          />
          <select
            className={selectClass}
            value={filters.status}
            onChange={(e) => patch({ status: e.target.value as StatusFilter })}
          >
            <option value="all">Status: todos</option>
            <option value="pending">Pendentes</option>
            <option value="completed">Pagos</option>
            <option value="rejected">Rejeitados</option>
          </select>
          <select
            className={selectClass}
            value={filters.paymentMethod}
            onChange={(e) => patch({ paymentMethod: e.target.value as OriginFilter })}
          >
            <option value="all">Origem: todas</option>
            <option value="metamask">MetaMask</option>
            <option value="manual">Manual</option>
          </select>
          <input
            className={inputClass}
            placeholder="Usuário"
            value={filters.user}
            onChange={(e) => patch({ user: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="E-mail"
            value={filters.email}
            onChange={(e) => patch({ email: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="Wallet"
            value={filters.wallet}
            onChange={(e) => patch({ wallet: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="Hash"
            value={filters.hash}
            onChange={(e) => patch({ hash: e.target.value })}
          />
          <input
            className={inputClass}
            type="number"
            min={0}
            step="0.01"
            placeholder="Valor mín."
            value={filters.minAmount}
            onChange={(e) => patch({ minAmount: e.target.value })}
          />
          <input
            className={inputClass}
            type="number"
            min={0}
            step="0.01"
            placeholder="Valor máx."
            value={filters.maxAmount}
            onChange={(e) => patch({ maxAmount: e.target.value })}
          />
          {filters.period === 'custom' && (
            <>
              <input
                className={inputClass}
                type="date"
                value={filters.from}
                onChange={(e) => patch({ from: e.target.value })}
              />
              <input
                className={inputClass}
                type="date"
                value={filters.to}
                onChange={(e) => patch({ to: e.target.value })}
              />
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <AdminButton variant="secondary" size="sm" onClick={() => void exportCsv()}>
            Exportar CSV
          </AdminButton>
          <AdminButton variant="secondary" size="sm" onClick={exportExcel}>
            Exportar Excel
          </AdminButton>
          <AdminButton variant="secondary" size="sm" onClick={printPdf}>
            Exportar PDF / Imprimir
          </AdminButton>
        </div>
      </div>

      {charts && (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 print:hidden">
          <MiniBarChart
            title="Saques por dia (qtd)"
            rows={charts.byDay.slice(-14).map((d) => ({ label: d.date.slice(5), value: d.count }))}
          />
          <MiniBarChart
            title="Valor pago por mês"
            valueKey="usdc"
            rows={charts.byMonth.map((m) => ({ label: m.month, value: m.paidUsdc }))}
          />
          <MiniBarChart
            title="Pendentes × Pagos"
            rows={charts.statusBreakdown.map((s) => ({
              label: withdrawalStatusLabel(s.status),
              value: s.count,
            }))}
          />
          <MiniBarChart
            title="Top usuários (pago)"
            valueKey="usdc"
            rows={charts.topUsers.slice(0, 8).map((u) => ({
              label: u.username ?? u.email ?? u.userId.slice(0, 8),
              value: u.paidUsdc,
            }))}
          />
          <MiniBarChart
            title="Saques por mês (qtd)"
            rows={charts.byMonth.map((m) => ({ label: m.month, value: m.count }))}
          />
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tempo médio de processamento
            </p>
            <p className="text-3xl font-bold text-emerald-300">
              {summary?.avgProcessMinutes != null
                ? `${summary.avgProcessMinutes.toFixed(0)} min`
                : '—'}
            </p>
            <p className="mt-1 text-xs text-slate-500">Média até pagamento (amostra filtrada)</p>
          </div>
        </div>
      )}

      <AdminTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(r) => r.id}
        loading={loading && !data}
        emptyMessage="Nenhum saque encontrado com estes filtros."
      />

      {data && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 print:hidden">
          <p>
            Página {data.pagination.page} de {data.pagination.totalPages} · {data.pagination.total}{' '}
            registros
          </p>
          <div className="flex items-center gap-2">
            <select
              className={selectClass}
              value={filters.limit}
              onChange={(e) => patch({ limit: Number(e.target.value), page: 1 })}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}/página
                </option>
              ))}
            </select>
            <AdminButton
              variant="secondary"
              size="sm"
              disabled={filters.page <= 1}
              onClick={() => patch({ page: filters.page - 1 })}
            >
              Anterior
            </AdminButton>
            <AdminButton
              variant="secondary"
              size="sm"
              disabled={filters.page >= data.pagination.totalPages}
              onClick={() => patch({ page: filters.page + 1 })}
            >
              Próxima
            </AdminButton>
          </div>
        </div>
      )}

      <DetailDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
