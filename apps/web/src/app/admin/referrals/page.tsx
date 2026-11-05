import { useEffect, useRef, useState } from 'react';
import type { AdminReferralCommissionDTO, AdminReferralCommissionsOverviewDTO } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import {
  AdminPageHeader,
  AdminBadge,
  AdminButton,
  AdminInput,
  AdminStatCard,
} from '../../../components/admin/AdminTable';
import { formatAdminDate } from '../../../lib/admin/i18n';

type Tab = 'overview' | 'list' | 'commissions';

interface Overview {
  totals: { totalReferrals: number; totalEarnedMgt: number };
  topReferrers: Array<{
    referrerId: string;
    username: string | null;
    email: string | null;
    referralCode: string | null;
    referralsCount: number;
    totalEarnedMgt: number;
  }>;
}

interface ListRow {
  referrerId: string;
  referrerLabel: string;
  referrerCode: string | null;
  referredId: string;
  referredLabel: string;
  totalEarnedMgt: number;
  createdAt: string;
}

const MEDAL = ['bi-trophy-fill', 'bi-award-fill', 'bi-award-fill'];

function RankBadge({ rank }: { rank: number }) {
  if (rank < 3) return <span className="text-base">{MEDAL[rank]}</span>;
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-xs font-bold text-slate-400">
      {rank + 1}
    </span>
  );
}

export function AdminReferralsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [filterReferrerId, setFilterReferrerId] = useState('');

  function drillIntoReferrer(referrerId: string) {
    setFilterReferrerId(referrerId);
    setTab('commissions');
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Visão Geral', icon: 'bi-bar-chart-fill' },
    { key: 'list', label: 'Indicações', icon: 'bi-people-fill' },
    { key: 'commissions', label: 'Comissões', icon: 'bi-cash-coin' },
  ];

  return (
    <>
      <AdminPageHeader
        title="Indicações"
        subtitle="Programa de referral — comissão configurável sobre depósitos USDC dos indicados, creditada em USDT sacável"
      />

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white/[0.08] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className={`bi ${t.icon} text-xs`} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab onDrillReferrer={drillIntoReferrer} />}
      {tab === 'list' && <ListTab />}
      {tab === 'commissions' && (
        <CommissionsTab
          initialReferrerId={filterReferrerId}
          onClearReferrer={() => setFilterReferrerId('')}
        />
      )}
    </>
  );
}

function OverviewTab({ onDrillReferrer }: { onDrillReferrer: (id: string) => void }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void adminClient
      .get<Overview>('/referrals/overview')
      .then((r) => setOverview(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-slate-400">Carregando...</p>
      </div>
    );
  }
  if (!overview) return null;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AdminStatCard
          label="Total de indicações"
          value={overview.totals.totalReferrals.toLocaleString('pt-BR')}
          icon="bi-people-fill"
          accent="sky"
        />
        <AdminStatCard
          label="Comissão total paga (GMT)"
          value={`${overview.totals.totalEarnedMgt.toFixed(2)} GMT`}
          icon="bi-coin"
          accent="amber"
        />
      </div>

      {/* Top referrers */}
      {overview.topReferrers.length > 0 && (
        <div className="admin-card overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
            <i className="bi bi-trophy-fill text-amber-400 text-sm" />
            <h3 className="text-sm font-semibold text-slate-200">Top 10 Indicadores</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">#</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Usuário</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Código</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Indicações</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Comissão (GMT)</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500" />
                </tr>
              </thead>
              <tbody>
                {overview.topReferrers.map((r, i) => (
                  <tr
                    key={r.referrerId}
                    className="border-b border-white/[0.03] transition-colors last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <RankBadge rank={i} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-200">
                        {r.username ?? r.email ?? r.referrerId.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 font-mono text-xs tracking-widest text-slate-400">
                        {r.referralCode ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-sky-300">{r.referralsCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono font-semibold text-amber-300">
                        {r.totalEarnedMgt.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AdminButton
                        size="sm"
                        variant="ghost"
                        onClick={() => onDrillReferrer(r.referrerId)}
                      >
                        <i className="bi bi-search text-xs" /> Ver comissões
                      </AdminButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ListTab() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await adminClient.get<{ items: ListRow[]; nextCursor: string | null }>(
        `/referrals?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      );
      setRows(res.data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500" />
          <AdminInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
            placeholder="Buscar por email / username"
            className="pl-8"
          />
        </div>
        <AdminButton onClick={() => void load()} disabled={loading}>
          <i className="bi bi-search text-xs" /> Buscar
        </AdminButton>
      </div>

      <div className="admin-card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-slate-400">Carregando...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {['Data', 'Indicador', 'Código', 'Indicado', 'Comissão (GMT)'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 last:text-right"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.referredId}
                    className="border-b border-white/[0.03] transition-colors last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                      {formatAdminDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200">{r.referrerLabel}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 font-mono text-xs tracking-widest text-slate-400">
                        {r.referrerCode ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.referredLabel}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-amber-300">
                      {r.totalEarnedMgt.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                      Nenhuma indicação encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CommissionsTab({
  initialReferrerId,
  onClearReferrer,
}: {
  initialReferrerId: string;
  onClearReferrer: () => void;
}) {
  const [commOverview, setCommOverview] = useState<AdminReferralCommissionsOverviewDTO | null>(null);
  const [items, setItems] = useState<AdminReferralCommissionDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [referrerFilter, setReferrerFilter] = useState(initialReferrerId);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  async function loadOverview(rid?: string) {
    const res = await adminClient.get<AdminReferralCommissionsOverviewDTO>(
      `/referrals/commissions/overview${rid ? `?referrerId=${encodeURIComponent(rid)}` : ''}`,
    );
    if (isMounted.current) setCommOverview(res.data);
  }

  async function loadItems(reset = true) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (referrerFilter) params.set('referrerId', referrerFilter);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (!reset && nextCursor) params.set('cursor', nextCursor);

      const res = await adminClient.get<{
        items: AdminReferralCommissionDTO[];
        nextCursor: string | null;
      }>(`/referrals/commissions?${params.toString()}`);

      if (!isMounted.current) return;
      setItems((prev) => (reset ? res.data.items : [...prev, ...res.data.items]));
      setNextCursor(res.data.nextCursor);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([loadOverview(initialReferrerId || undefined), loadItems(true)]);
  }, []);

  async function applyFilters() {
    await Promise.all([loadOverview(referrerFilter || undefined), loadItems(true)]);
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        {initialReferrerId ? (
          <span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
            <i className="bi bi-funnel-fill text-[10px]" />
            Filtrando por indicador
            <button
              type="button"
              onClick={() => {
                setReferrerFilter('');
                onClearReferrer();
                void Promise.all([loadOverview(undefined), loadItems(true)]);
              }}
              className="ml-1 opacity-70 hover:opacity-100"
            >
              <i className="bi bi-x text-xs" />
            </button>
          </span>
        ) : (
          <AdminInput
            value={referrerFilter}
            onChange={(e) => setReferrerFilter(e.target.value)}
            placeholder="ID do indicador"
            className="w-52"
          />
        )}
        <span className="text-xs text-slate-500">De</span>
        <AdminInput
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-36"
        />
        <span className="text-xs text-slate-500">até</span>
        <AdminInput
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-36"
        />
        <AdminButton onClick={() => void applyFilters()} disabled={loading}>
          <i className="bi bi-funnel text-xs" /> Filtrar
        </AdminButton>
      </div>

      {/* Summary cards */}
      {commOverview && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AdminStatCard
            label="Comissões pagas (USDT)"
            value={`${commOverview.totalCommissionsGmt.toFixed(6)} USDT`}
            icon="bi-coin"
            accent="amber"
          />
          <AdminStatCard
            label="Depósitos via referral (USDC)"
            value={`$${commOverview.totalDepositedUsdc.toFixed(2)}`}
            icon="bi-arrow-down-circle-fill"
            accent="emerald"
          />
          <AdminStatCard
            label="Eventos de comissão"
            value={commOverview.totalEvents.toLocaleString('pt-BR')}
            icon="bi-lightning-fill"
            accent="sky"
          />
        </div>
      )}

      {/* By-referrer breakdown */}
      {commOverview && commOverview.byReferrer.length > 0 && (
        <div className="admin-card overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
            <i className="bi bi-person-lines-fill text-sm text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">Por indicador</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                  {['Indicador', 'Código', 'Eventos', 'Depósitos (USDC)', 'Comissão (USDT)'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 last:text-right"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commOverview.byReferrer.map((r) => (
                  <tr
                    key={r.referrerId}
                    className="border-b border-white/[0.03] transition-colors last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 font-medium text-slate-200">{r.referrerLabel}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 font-mono text-xs tracking-widest text-slate-400">
                        {r.referrerCode ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sky-300">{r.eventsCount}</td>
                    <td className="px-4 py-3 font-mono text-emerald-300">${r.totalDepositedUsdc.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-amber-300">{r.totalCommissionGmt.toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Individual events */}
      <div className="admin-card overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <i className="bi bi-list-ul text-sm text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">Eventos individuais</h3>
          {items.length > 0 && (
            <AdminBadge variant="info">{items.length}</AdminBadge>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-slate-400">Carregando...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                  {['Data', 'Indicador', 'Indicado', 'Depósito (USDC)', 'Comissão (USDT)', 'Status', 'Tx Hash'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-white/[0.03] transition-colors last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                      {formatAdminDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200">{r.referrerLabel}</td>
                    <td className="px-4 py-3 text-slate-400">{r.referredLabel || '—'}</td>
                    <td className="px-4 py-3 font-mono text-emerald-300">${r.sourceAmountUsdc.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-amber-300">{r.commissionUsdc.toFixed(6)}</td>
                    <td className="px-4 py-3 text-xs uppercase text-slate-300">{r.status}</td>
                    <td className="px-4 py-3">
                      {r.txHash ? (
                        <span className="font-mono text-xs text-slate-500">{r.txHash.slice(0, 10)}…</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                      Sem eventos de comissão.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {nextCursor && (
          <div className="border-t border-white/[0.06] px-4 py-3">
            <AdminButton
              variant="secondary"
              size="sm"
              onClick={() => void loadItems(false)}
              disabled={loading}
            >
              <i className="bi bi-chevron-down text-xs" /> Carregar mais
            </AdminButton>
          </div>
        )}
      </div>
    </div>
  );
}
