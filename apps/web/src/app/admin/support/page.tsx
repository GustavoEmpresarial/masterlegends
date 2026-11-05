import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SupportMessageDTO, SupportTicketDetailDTO, SupportTicketDTO } from '@mll/shared';
import { SupportAttachmentImage } from '../../../components/support/SupportAttachmentImage';
import { UserAccountPanel } from '../../../components/admin/UserAccountPanel';
import { AdminUserFilters } from '../../../components/admin/AdminUserFilters';
import { adminClient } from '../../../lib/api/adminClient';
import {
  DEFAULT_USER_FILTERS,
  userFiltersToQuery,
  type AdminUserFilterState,
} from '../../../lib/admin/userFilters';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import { AdminPageHeader } from '../../../components/admin/AdminTable';
import { adminPt, authorTypeLabel, ticketStatusLabel } from '../../../lib/admin/i18n';

type StatusKey = 'open' | 'in_progress' | 'resolved' | 'closed';

const COLUMNS: { key: StatusKey; tone: string }[] = [
  { key: 'open', tone: 'border-amber-500/40 bg-amber-500/[0.04]' },
  { key: 'in_progress', tone: 'border-sky-500/40 bg-sky-500/[0.04]' },
  { key: 'resolved', tone: 'border-emerald-500/40 bg-emerald-500/[0.04]' },
  { key: 'closed', tone: 'border-slate-500/40 bg-slate-500/[0.04]' },
];

const PRIORITY_TONE: Record<string, string> = {
  high: 'bg-red-500/15 text-red-300 border-red-500/40',
  normal: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
  low: 'bg-slate-700/40 text-slate-400 border-slate-600/40',
};

const PAGE_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 350;

function formatRelative(iso: string | null): string {
  if (!iso) return '–';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d`;
  return d.toLocaleDateString('pt-BR');
}

export function AdminSupportPage() {
  const { canManageUsers, canViewUsers } = useAdminAuth();
  const [columnData, setColumnData] = useState<Record<StatusKey, SupportTicketDTO[]>>({
    open: [],
    in_progress: [],
    resolved: [],
    closed: [],
  });
  const [loading, setLoading] = useState<Record<StatusKey, boolean>>({
    open: false,
    in_progress: false,
    resolved: false,
    closed: false,
  });
  const [nextCursor, setNextCursor] = useState<Record<StatusKey, string | undefined>>({
    open: undefined,
    in_progress: undefined,
    resolved: undefined,
    closed: undefined,
  });

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [userFilters, setUserFilters] = useState<AdminUserFilterState>(DEFAULT_USER_FILTERS);
  const [debouncedUserFilters, setDebouncedUserFilters] = useState<AdminUserFilterState>(DEFAULT_USER_FILTERS);
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<SupportTicketDetailDTO | null>(null);
  const [reply, setReply] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const t = adminPt.support;

  function notify(kind: 'ok' | 'err', msg: string) {
    setFlash({ kind, msg });
    window.setTimeout(() => setFlash(null), 4000);
  }

  function extractError(err: unknown): string {
    if (err && typeof err === 'object') {
      const anyErr = err as { response?: { data?: { message?: string; error?: unknown } }; message?: string };
      const data = anyErr.response?.data;
      if (data && typeof data === 'object') {
        if (typeof data.message === 'string') return data.message;
        if (typeof data.error === 'string') return data.error;
        if (data.error && typeof data.error === 'object') {
          const e = data.error as { message?: string };
          if (typeof e.message === 'string') return e.message;
        }
      }
      if (typeof anyErr.message === 'string') return anyErr.message;
    }
    return 'Erro desconhecido';
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedUserFilters(userFilters), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [userFilters]);

  const loadColumn = useCallback(async (status: StatusKey, cursor?: string) => {
    setLoading((s) => ({ ...s, [status]: true }));
    try {
      const params: Record<string, string> = {
        status,
        limit: String(PAGE_LIMIT),
        ...userFiltersToQuery({ ...debouncedUserFilters, search: debouncedUserFilters.search }),
      };
      if (cursor) params.cursor = cursor;
      const { data } = await adminClient.get<{ tickets: SupportTicketDTO[]; nextCursor?: string }>(
        '/support/tickets',
        { params },
      );
      setColumnData((c) => ({
        ...c,
        [status]: cursor ? [...c[status], ...data.tickets] : data.tickets,
      }));
      setNextCursor((n) => ({ ...n, [status]: data.nextCursor }));
    } finally {
      setLoading((s) => ({ ...s, [status]: false }));
    }
  }, [debouncedUserFilters]);

  const loadAll = useCallback(() => {
    COLUMNS.forEach((col) => void loadColumn(col.key));
  }, [loadColumn]);

  useEffect(() => {
    loadAll();
  }, [loadAll, debouncedUserFilters]);

  const allTickets = useMemo(
    () => Object.values(columnData).flat(),
    [columnData],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    allTickets.forEach((t) => set.add(t.category));
    return [...set].sort();
  }, [allTickets]);

  const filterFn = useCallback(
    (ticket: SupportTicketDTO) => {
      if (priorityFilter && ticket.priority !== priorityFilter) return false;
      if (categoryFilter && ticket.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${ticket.subject} ${ticket.username ?? ''} ${ticket.userEmail ?? ''} ${ticket.userWallet ?? ''} ${ticket.category} ${ticket.userId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    },
    [search, priorityFilter, categoryFilter],
  );

  const filteredColumns = useMemo(() => {
    const out = {} as Record<StatusKey, SupportTicketDTO[]>;
    for (const col of COLUMNS) {
      out[col.key] = columnData[col.key].filter(filterFn);
    }
    return out;
  }, [columnData, filterFn]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInColumn(status: StatusKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = filteredColumns[status].map((t) => t.id);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function openTicket(id: string) {
    const { data } = await adminClient.get<SupportTicketDetailDTO>(`/support/tickets/${id}`);
    setDetail(data);
    setReply('');
  }

  async function sendReply() {
    if (!detail || !reply.trim()) return;
    try {
      await adminClient.post(`/support/tickets/${detail.id}/messages`, { body: reply });
      setReply('');
      await openTicket(detail.id);
      loadAll();
      notify('ok', 'Resposta enviada');
    } catch (err) {
      console.error('[admin/support] sendReply failed', err);
      notify('err', `Falha ao enviar: ${extractError(err)}`);
    }
  }

  async function patchTicket(id: string, patch: Record<string, unknown>) {
    console.debug('[admin/support] PATCH /support/tickets/%s', id, patch);
    const { data } = await adminClient.patch(`/support/tickets/${id}`, patch);
    console.debug('[admin/support] PATCH result', data);
    return data;
  }

  async function moveTicket(id: string, status: StatusKey) {
    try {
      await patchTicket(id, { status });
      if (detail?.id === id) await openTicket(id);
      loadAll();
      notify('ok', `Ticket movido para ${ticketStatusLabel(status)}`);
    } catch (err) {
      console.error('[admin/support] moveTicket failed', err);
      notify('err', `Falha ao mover: ${extractError(err)}`);
    }
  }

  async function bulkUpdateStatus(status: StatusKey) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(
        [...selected].map((id) => patchTicket(id, { status })),
      );
      const failures = results.filter((r) => r.status === 'rejected');
      setSelected(new Set());
      loadAll();
      if (failures.length > 0) {
        const first = failures[0] as PromiseRejectedResult;
        notify('err', `${failures.length} falha(s). Ex: ${extractError(first.reason)}`);
      } else {
        notify('ok', `${results.length} ticket(s) atualizados`);
      }
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeader title={t.title} subtitle={t.subtitle} />

      {flash && (
        <div
          role="status"
          className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
            flash.kind === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/40 bg-red-500/10 text-red-200'
          }`}
        >
          {flash.msg}
        </div>
      )}

      {/* Toolbar: busca + filtros */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ticket: assunto, nick, e-mail, carteira ou ID…"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            name="admin-support-search"
            className="min-w-[220px] flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
          />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">Prioridade: todas</option>
            <option value="high">Alta</option>
            <option value="normal">Normal</option>
            <option value="low">Baixa</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">Categoria: todas</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadAll}
            className="rounded border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
          >
            <i className="bi bi-arrow-clockwise mr-1" /> Atualizar
          </button>
        </div>
        <AdminUserFilters
          filters={userFilters}
          onChange={setUserFilters}
          searchPlaceholder="Filtrar usuário do ticket (e-mail, nick, ID, carteira)…"
        />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-14 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
          <span className="font-medium text-emerald-300">
            {selected.size} selecionado{selected.size > 1 ? 's' : ''}
          </span>
          <div className="flex-1" />
          {COLUMNS.map((c) => (
            <button
              key={c.key}
              type="button"
              disabled={bulkBusy}
              onClick={() => void bulkUpdateStatus(c.key)}
              className="rounded border border-slate-600 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              → {ticketStatusLabel(c.key)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Kanban */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = filteredColumns[col.key];
          const totalLoaded = columnData[col.key].length;
          const isLoading = loading[col.key];
          return (
            <div
              key={col.key}
              className={`flex min-h-[300px] flex-col rounded-lg border ${col.tone} p-3`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    {ticketStatusLabel(col.key)}
                  </h3>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-slate-300">
                    {items.length}
                    {items.length !== totalLoaded && (
                      <span className="text-slate-500"> / {totalLoaded}</span>
                    )}
                  </span>
                </div>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => selectAllInColumn(col.key)}
                    className="text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    {items.every((t) => selected.has(t.id)) ? 'Desmarcar' : 'Marcar todos'}
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {items.map((ticket) => {
                  const isSelected = selected.has(ticket.id);
                  return (
                    <div
                      key={ticket.id}
                      className={`group rounded-md border bg-slate-900/60 p-2.5 text-sm transition-colors ${
                        isSelected
                          ? 'border-emerald-500/70 ring-1 ring-emerald-500/40'
                          : 'border-slate-700/50 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(ticket.id)}
                          className="mt-1 h-3.5 w-3.5 cursor-pointer accent-emerald-500"
                          aria-label="selecionar"
                        />
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => void openTicket(ticket.id)}
                            className="block w-full truncate text-left font-medium text-slate-100 hover:text-emerald-300"
                          >
                            {ticket.subject}
                          </button>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                            <span className="text-slate-300">{ticket.username ?? ticket.userId.slice(0, 8)}</span>
                            <span>·</span>
                            <span>{ticket.category}</span>
                            <span>·</span>
                            <span>{formatRelative(ticket.lastMessageAt ?? ticket.updatedAt)}</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                                PRIORITY_TONE[ticket.priority] ?? PRIORITY_TONE.normal
                              }`}
                            >
                              {ticket.priority}
                            </span>
                            {ticket.userIsDepositor && (
                              <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                                Depositante
                              </span>
                            )}
                            {ticket.userWallet && (
                              <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300">
                                Carteira
                              </span>
                            )}
                            {!ticket.userHasClub && (
                              <span className="rounded border border-slate-600/40 bg-slate-800/40 px-1.5 py-0.5 text-[10px] text-slate-400">
                                Sem clube
                              </span>
                            )}
                            <div className="ml-auto flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                                <button
                                  key={c.key}
                                  type="button"
                                  title={`Mover para ${ticketStatusLabel(c.key)}`}
                                  onClick={() => void moveTicket(ticket.id, c.key)}
                                  className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
                                >
                                  →{ticketStatusLabel(c.key).slice(0, 3)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!isLoading && items.length === 0 && (
                  <p className="py-6 text-center text-xs text-slate-500">Vazio</p>
                )}
                {isLoading && (
                  <p className="py-6 text-center text-xs text-slate-500">Carregando…</p>
                )}
              </div>

              {nextCursor[col.key] && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => void loadColumn(col.key, nextCursor[col.key])}
                  className="mt-2 rounded border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Carregar mais
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal conversa + auditoria */}
      {detail && (
        <div className="fixed inset-0 z-50 flex bg-black/70 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div
            className="ml-auto flex h-full w-full max-w-[1100px] flex-col bg-[#0c1220] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-white">{detail.subject}</h2>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {detail.category} · {ticketStatusLabel(detail.status)} ·{' '}
                  <span className={`rounded border px-1.5 py-px text-[10px] ${PRIORITY_TONE[detail.priority] ?? PRIORITY_TONE.normal}`}>
                    {detail.priority}
                  </span>
                  {detail.username && (
                    <>
                      {' · '}
                      <Link to={`/admin/users/${detail.userId}`} className="text-emerald-400 hover:underline">
                        {detail.username}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-lg border border-slate-700 px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
                aria-label="Fechar"
              >
                <i className="bi bi-x-lg" aria-hidden />
              </button>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
              {/* Conversa */}
              <div className="flex min-h-0 flex-col border-r border-white/[0.06]">
                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {detail.messages.map((m: SupportMessageDTO) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-lg p-3 text-sm ${
                        m.authorType === 'admin'
                          ? 'ml-auto bg-emerald-900/40 text-emerald-50'
                          : 'bg-slate-800/70 text-slate-100'
                      }`}
                    >
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
                        {authorTypeLabel(m.authorType)} · {new Date(m.createdAt).toLocaleString('pt-BR')}
                      </p>
                      {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                      {m.attachments?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {m.attachments.map((att) => (
                            <SupportAttachmentImage
                              key={att.id}
                              attachmentId={att.id}
                              variant="admin"
                              className="max-h-40 rounded border border-slate-600 object-contain"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/[0.06] p-4">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    name="admin-support-reply"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    placeholder={t.replyPlaceholder}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void sendReply()}
                      className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium hover:bg-emerald-600"
                    >
                      {adminPt.send}
                    </button>
                    <div className="ml-auto flex flex-wrap gap-1.5">
                      {(['open', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={detail.status === s}
                          onClick={() => void moveTicket(detail.id, s)}
                          className="rounded border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                        >
                          {ticketStatusLabel(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Auditoria */}
              <div className="min-h-0 overflow-y-auto bg-[#070b14]/40 px-4 py-4">
                <h3 className="mb-3 border-b border-slate-800 pb-2 text-sm font-semibold text-slate-200">
                  {t.userAudit}
                </h3>
                {canViewUsers ? (
                  <UserAccountPanel
                    key={detail.userId}
                    userId={detail.userId}
                    canManage={canManageUsers}
                    embedded
                  />
                ) : (
                  <p className="text-xs text-slate-500">Sem permissão para visualizar dados do jogador.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
