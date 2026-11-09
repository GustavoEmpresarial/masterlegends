import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  AdminPlatformRoiDTO,
  AdminUserRoiDTO,
  AdminUserRoiListItemDTO,
} from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminPageHeader } from '../../../components/admin/AdminTable';
import {
  AlertBadge,
  fmtPct,
  fmtUsdc,
  LiveIndicator,
  PlatformOverview,
  UserDetailPanel,
} from '../../../components/admin/roi/RoiUi';

const SEARCH_DEBOUNCE_MS = 350;
const REFRESH_MS = 30_000;
const PAGE_SIZE = 50;

type TabId = 'geral' | 'usuarios';
type RoiSort = 'mining_desc' | 'capital_desc' | 'roi_desc' | 'name_asc';

export function AdminRoiPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const userIdParam = searchParams.get('userId') ?? '';
  const tabParam = searchParams.get('tab') as TabId | null;

  const [tab, setTab] = useState<TabId>(tabParam === 'usuarios' ? 'usuarios' : 'geral');
  const [platform, setPlatform] = useState<AdminPlatformRoiDTO | null>(null);
  const [userRoi, setUserRoi] = useState<AdminUserRoiDTO | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(userIdParam || null);
  const [userList, setUserList] = useState<AdminUserRoiListItemDTO[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | undefined>(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<RoiSort>('mining_desc');
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadPlatform = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const { data } = await adminClient.get<AdminPlatformRoiDTO>('/roi/platform');
      setPlatform(data);
      setLastSync(new Date());
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  const loadUserList = useCallback(
    async (offset = 0, append = false) => {
      setListLoading(true);
      try {
        const { data } = await adminClient.get<{
          users: AdminUserRoiListItemDTO[];
          total: number;
          nextOffset?: number;
        }>('/roi/users', {
          params: {
            limit: PAGE_SIZE,
            offset,
            sort,
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
          },
        });
        setUserList((prev) => (append ? [...prev, ...data.users] : data.users));
        setListTotal(data.total);
        setNextOffset(data.nextOffset);
      } finally {
        setListLoading(false);
      }
    },
    [debouncedSearch, sort],
  );

  const loadUser = useCallback(
    async (userId: string, silent = false) => {
      if (!userId.trim()) {
        setUserRoi(null);
        setSelectedId(null);
        return;
      }
      if (!silent) setUserLoading(true);
      setError('');
      try {
        const { data } = await adminClient.get<AdminUserRoiDTO>(`/users/${userId.trim()}/roi`);
        setUserRoi(data);
        setSelectedId(userId.trim());
        setSearchParams({ tab: 'usuarios', userId: userId.trim() }, { replace: true });
        setTab('usuarios');
      } catch {
        setError('Usuário não encontrado.');
        setUserRoi(null);
      } finally {
        if (!silent) setUserLoading(false);
      }
    },
    [setSearchParams],
  );

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadPlatform(true),
        loadUserList(0, false),
        selectedId ? loadUser(selectedId, true) : Promise.resolve(),
      ]);
      setLastSync(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [loadPlatform, loadUserList, loadUser, selectedId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadPlatform(true);
        await loadUserList(0, false);
        if (userIdParam) await loadUser(userIdParam, true);
      } catch {
        setError('Falha ao carregar dados de ROI.');
      } finally {
        setLoading(false);
        setLastSync(new Date());
      }
    })();
  }, []);

  useEffect(() => {
    void loadUserList(0, false);
  }, [loadUserList]);

  useEffect(() => {
    const id = window.setInterval(() => void refreshAll(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refreshAll]);

  function switchTab(next: TabId) {
    setTab(next);
    const params: Record<string, string> = { tab: next };
    if (selectedId) params.userId = selectedId;
    setSearchParams(params, { replace: true });
  }

  function selectUser(userId: string) {
    void loadUser(userId);
  }

  const filteredList = onlyAlerts ? userList.filter((u) => u.alertLevel !== 'ok') : userList;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <AdminPageHeader
          title="Patrocínios & ROI"
          subtitle="Auditoria em tempo real da economia MLL — capital depositado vs rendimento a cada 10 min"
        />
        <div className="flex flex-wrap items-center gap-2 sm:pt-1">
          <LiveIndicator lastSync={lastSync} refreshing={refreshing && !loading} />
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06] disabled:opacity-50"
          >
            <i className={`bi bi-arrow-clockwise ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
            Atualizar
          </button>
        </div>
      </div>

      {error && !userRoi && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {(
          [
            { id: 'geral' as const, label: 'ROI Geral', icon: 'bi-speedometer2' },
            { id: 'usuarios' as const, label: 'Usuários', icon: 'bi-people' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:flex-none sm:px-6 ${
              tab === t.id
                ? 'bg-emerald-500/15 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <i className={`bi ${t.icon}`} aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      {loading && !platform ? (
        <div className="admin-card flex items-center justify-center py-20">
          <i className="bi bi-arrow-repeat animate-spin text-2xl text-emerald-400" aria-hidden />
        </div>
      ) : tab === 'geral' && platform ? (
        <PlatformOverview platform={platform} onAuditUser={(id) => selectUser(id)} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-5">
          <div className="space-y-4 xl:col-span-3">
            {platform && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'ROI plataforma', value: fmtPct(platform.roi.percentOnCapital), accent: 'text-emerald-300' },
                  { label: 'Capital total', value: `${fmtUsdc(platform.capital.netCapitalInUsdc)} USDC`, accent: 'text-sky-300' },
                  { label: 'Patrocínios', value: `${fmtUsdc(platform.totals.distributedUsdc)} USDT`, accent: 'text-white' },
                  { label: 'Miners', value: String(platform.roi.minersCount), accent: 'text-amber-300' },
                ].map((k) => (
                  <div key={k.label} className="admin-card px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</p>
                    <p className={`text-sm font-bold ${k.accent}`}>{k.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="admin-card p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {listTotal.toLocaleString('pt-BR')} usuários
                  </h2>
                  <p className="text-xs text-slate-500">Email, username, wallet ou ID</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative min-w-[12rem] flex-1">
                    <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar…"
                      className="w-full rounded-lg border border-white/[0.08] bg-[#0c1220] py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-600"
                    />
                  </div>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as RoiSort)}
                    className="rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="mining_desc">Patrocínio ↓</option>
                    <option value="roi_desc">ROI ↓</option>
                    <option value="capital_desc">Capital ↓</option>
                    <option value="name_asc">Nome A–Z</option>
                  </select>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={onlyAlerts}
                      onChange={(e) => setOnlyAlerts(e.target.checked)}
                      className="rounded border-white/20"
                    />
                    Só alertas
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2.5">Usuário</th>
                      <th className="px-3 py-2.5 text-right">Capital</th>
                      <th className="px-3 py-2.5 text-right">Patrocínios</th>
                      <th className="px-3 py-2.5 text-right">ROI</th>
                      <th className="px-3 py-2.5 text-right">24h</th>
                      <th className="px-3 py-2.5 text-right">Saldo USDC</th>
                      <th className="px-3 py-2.5 text-right">Saldo USDT</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {listLoading && filteredList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-12 text-center text-slate-500">
                          <i className="bi bi-arrow-repeat mr-2 inline-block animate-spin" aria-hidden />
                          Carregando…
                        </td>
                      </tr>
                    ) : filteredList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-12 text-center text-slate-500">
                          {debouncedSearch ? 'Nenhum usuário encontrado.' : 'Nenhum usuário com patrocínio ou capital.'}
                        </td>
                      </tr>
                    ) : (
                      filteredList.map((u) => {
                        const active = selectedId === u.userId;
                        return (
                          <tr
                            key={u.userId}
                            onClick={() => selectUser(u.userId)}
                            className={`cursor-pointer border-b border-white/[0.04] transition-colors ${
                              active ? 'bg-emerald-500/10' : 'hover:bg-white/[0.03]'
                            }`}
                          >
                            <td className="px-3 py-2.5">
                              <div className="font-medium text-slate-200">{u.username ?? u.email ?? u.userId.slice(0, 8)}</div>
                              {u.username && u.email && <div className="text-xs text-slate-500">{u.email}</div>}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{fmtUsdc(u.netCapitalIn)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-emerald-300/90">{fmtUsdc(u.totalPaidUsdc)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              <span className={u.roiPercent != null && u.roiPercent > 50 ? 'text-amber-300' : 'text-slate-200'}>
                                {fmtPct(u.roiPercent)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{fmtUsdc(u.last24hUsdc)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{fmtUsdc(u.currentUsdc)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-amber-300/90">{fmtUsdc(u.currentUsdt)}</td>
                            <td className="px-3 py-2.5">
                              {u.alertLevel !== 'ok' ? <AlertBadge level={u.alertLevel} compact /> : null}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {nextOffset != null && !onlyAlerts && (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    disabled={listLoading}
                    onClick={() => void loadUserList(nextOffset, true)}
                    className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs text-slate-400 hover:bg-white/[0.04] disabled:opacity-50"
                  >
                    {listLoading ? 'Carregando…' : `Mais usuários (${userList.length} / ${listTotal})`}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-2">
            <UserDetailPanel
              data={userRoi}
              loading={userLoading}
              onClose={() => {
                setUserRoi(null);
                setSelectedId(null);
                setSearchParams({ tab: 'usuarios' }, { replace: true });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
