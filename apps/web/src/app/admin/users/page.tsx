import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminUserListItemDTO } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminBadge, AdminPageHeader, AdminTable } from '../../../components/admin/AdminTable';
import { AdminUserFilters } from '../../../components/admin/AdminUserFilters';
import {
  DEFAULT_USER_FILTERS,
  userFiltersToQuery,
  type AdminUserFilterState,
} from '../../../lib/admin/userFilters';
import { adminPt } from '../../../lib/admin/i18n';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserListItemDTO[]>([]);
  const [filters, setFilters] = useState<AdminUserFilterState>(DEFAULT_USER_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const t = adminPt.users;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const queryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const fetchPage = useCallback(
    async (cursor?: string) => {
      const params: Record<string, string> = { limit: String(PAGE_SIZE), ...userFiltersToQuery(queryFilters) };
      if (cursor) params.cursor = cursor;
      const { data } = await adminClient.get<{
        users: AdminUserListItemDTO[];
        nextCursor?: string;
      }>('/users', { params });
      return data;
    },
    [queryFilters],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPage();
      setUsers(data.users);
      setNextCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextCursor);
      setUsers((prev) => [...prev, ...data.users]);
      setNextCursor(data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, fetchPage]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <AdminPageHeader title={t.title} subtitle={t.subtitle} />
      <AdminUserFilters filters={filters} onChange={setFilters} searchPlaceholder={t.searchPlaceholder} />
      <div className="mb-2 text-xs text-slate-500">
        Exibindo {users.length} {users.length === 1 ? 'usuário' : 'usuários'}
        {nextCursor ? ' (há mais)' : ''}
      </div>
      <AdminTable
        loading={loading}
        rows={users}
        rowKey={(u) => u.id}
        emptyMessage={t.empty}
        columns={[
          {
            key: 'email',
            header: adminPt.email,
            render: (u) =>
              u.email ? (
                <Link
                  to={`/admin/users/${u.id}`}
                  className="text-emerald-400 hover:text-emerald-300 hover:underline"
                >
                  {u.email}
                </Link>
              ) : (
                adminPt.dash
              ),
          },
          {
            key: 'username',
            header: adminPt.username,
            render: (u) =>
              u.username ? (
                <Link
                  to={`/admin/users/${u.id}`}
                  className="text-slate-200 hover:text-emerald-300 hover:underline"
                >
                  {u.username}
                </Link>
              ) : (
                adminPt.dash
              ),
          },
          {
            key: 'tags',
            header: 'Perfil',
            render: (u) => (
              <div className="flex flex-wrap gap-1">
                {u.isDepositor && <AdminBadge variant="success">Depositante</AdminBadge>}
                {u.wallet && <AdminBadge variant="info">Carteira</AdminBadge>}
                {u.emailVerifiedAt && <AdminBadge variant="default">E-mail OK</AdminBadge>}
                {u.disabled && <AdminBadge variant="warning">{t.disabled}</AdminBadge>}
                {(u.openTickets ?? 0) > 0 && (
                  <AdminBadge variant="warning">Ticket ({u.openTickets})</AdminBadge>
                )}
                {(u.pendingWithdrawals ?? 0) > 0 && (
                  <AdminBadge variant="warning">Saque ({u.pendingWithdrawals})</AdminBadge>
                )}
              </div>
            ),
          },
          {
            key: 'club',
            header: 'Clube',
            render: (u) =>
              u.clubName ? (
                <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                  <i className="bi bi-shield-fill" aria-hidden />
                  {u.clubName}
                </span>
              ) : (
                <span className="text-xs text-slate-500">{adminPt.dash}</span>
              ),
          },
          {
            key: 'status',
            header: adminPt.status,
            render: (u) =>
              u.bannedAt ? (
                <AdminBadge variant="danger">{t.banned}</AdminBadge>
              ) : (
                <AdminBadge variant="success">{t.active}</AdminBadge>
              ),
          },
          { key: 'gmt', header: 'GMT', render: (u) => (u.gmtBalance ?? 0).toLocaleString('pt-BR') },
          { key: 'usdc', header: 'USDC', render: (u) => (u.usdcBalance ?? 0).toLocaleString('pt-BR') },
          {
            key: 'actions',
            header: adminPt.actions,
            render: (u) => (
              <Link
                to={`/admin/users/${u.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
              >
                <i className="bi bi-pencil-square" aria-hidden />
                {t.viewAccount}
              </Link>
            ),
          },
        ]}
      />
      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-lg border border-emerald-700/40 bg-emerald-700/20 hover:bg-emerald-700/40 disabled:opacity-50 px-6 py-2 text-sm text-emerald-300"
          >
            {loadingMore ? 'Carregando…' : `↓ Carregar mais ${PAGE_SIZE}`}
          </button>
        </div>
      )}
    </>
  );
}
