import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminButton, AdminInput, AdminPageHeader } from '../../../components/admin/AdminTable';

interface FailureEntry {
  id: string;
  ts: string;
  kind: string;
  reason: string;
  surface: string | null;
  route: string | null;
  area: string | null;
  tab: string | null;
  userId: string | null;
  adminLogin: string | null;
  ip: string | null;
  userAgent: string | null;
  message: string | null;
  context: Record<string, unknown> | null;
}

interface FailureSummary {
  total: number;
  byKind: { kind: string; count: number }[];
  byReason: { kind: string; reason: string; count: number }[];
  byRoute: { route: string; count: number }[];
  byArea: { area: string; count: number }[];
  topUsers: { userId: string; count: number }[];
  hourly: { hour: string; count: number }[];
}

const KIND_LABELS: Record<string, string> = {
  support_upload: 'Suporte — upload',
  support_submit: 'Suporte — envio',
  wallet_connect: 'Carteira — conectar',
  wallet_sign: 'Carteira — assinatura',
  wallet_chain_switch: 'Carteira — trocar rede',
  wallet_link: 'Carteira — vincular',
  deposit: 'Depósito',
  react_error: 'Crash React',
  unhandled_rejection: 'Promise rejeitada',
  window_error: 'Erro JS global',
  api_error: 'Erro de API',
  query_error: 'Erro React Query',
  mutation_error: 'Erro de mutation',
  other: 'Outro',
};

const SURFACE_LABELS: Record<string, string> = {
  player: 'Jogo / usuário',
  admin: 'Admin',
  public: 'Público',
};

const REASON_LABELS: Record<string, string> = {
  file_too_large: 'Arquivo muito grande',
  file_too_large_after_encode: 'Muito grande após processar',
  unsupported_mime: 'Formato não suportado',
  invalid_image_dimensions: 'Imagem inválida',
  empty_file: 'Arquivo vazio',
  too_many_files: 'Muitos arquivos',
  user_rejected: 'Usuário rejeitou',
  request_pending: 'Solicitação pendente',
  request_failed: 'Falha na requisição',
  switch_failed: 'Falha ao trocar rede',
};

function labelKind(k: string): string {
  return KIND_LABELS[k] ?? k;
}
function labelReason(r: string): string {
  return REASON_LABELS[r] ?? r;
}
function labelSurface(s: string | null): string {
  if (!s) return '—';
  return SURFACE_LABELS[s] ?? s;
}

function isoHoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
      <div className="h-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
    </div>
  );
}

function HourlyChart({ data }: { data: { hour: string; count: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map((d) => (
        <div
          key={d.hour}
          title={`${new Date(d.hour).toLocaleString('pt-BR')}: ${d.count}`}
          className="flex-1 bg-amber-500/60 hover:bg-amber-400 rounded-sm min-h-[2px]"
          style={{ height: `${(d.count / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

export function AdminFailuresPage() {
  const [items, setItems] = useState<FailureEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<FailureSummary | null>(null);
  const [kind, setKind] = useState('');
  const [reason, setReason] = useState('');
  const [userId, setUserId] = useState('');
  const [surface, setSurface] = useState('');
  const [route, setRoute] = useState('');
  const [area, setArea] = useState('');
  const [hours, setHours] = useState(24);
  const [limit] = useState(100);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const from = isoHoursAgo(hours);
      const params: Record<string, string | number> = { from, limit };
      if (kind) params.kind = kind;
      if (reason) params.reason = reason;
      if (userId) params.userId = userId;
      if (surface) params.surface = surface;
      if (route) params.route = route;
      if (area) params.area = area;
      const summaryParams: Record<string, string> = { from };
      if (surface) summaryParams.surface = surface;
      if (area) summaryParams.area = area;
      const [{ data: list }, { data: sum }] = await Promise.all([
        adminClient.get<{ items: FailureEntry[]; total: number }>('/failures', { params }),
        adminClient.get<FailureSummary>('/failures/summary', { params: summaryParams }),
      ]);
      setItems(list.items);
      setTotal(list.total);
      setSummary(sum);
    } finally {
      setLoading(false);
    }
  }, [hours, kind, reason, userId, surface, route, area, limit]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const maxByKind = useMemo(
    () => Math.max(...(summary?.byKind.map((k) => k.count) ?? [0]), 1),
    [summary],
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Relatório de Falhas Automáticas"
        subtitle={`Últimas ${hours}h · ${total.toLocaleString('pt-BR')} ocorrências no filtro`}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
            >
              <option value={1}>1h</option>
              <option value={6}>6h</option>
              <option value={24}>24h</option>
              <option value={72}>72h</option>
              <option value={168}>7d</option>
            </select>
            <AdminButton onClick={() => void fetchData()} disabled={loading}>
              {loading ? '…' : '↻ Atualizar'}
            </AdminButton>
          </div>
        }
      />

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Por tipo de falha
            </p>
            <div className="space-y-2">
              {summary.byKind.length === 0 && (
                <p className="text-xs text-slate-500">Nenhuma falha no período.</p>
              )}
              {summary.byKind.map((k) => (
                <div key={k.kind} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setKind(k.kind === kind ? '' : k.kind)}
                      className={`text-left hover:text-emerald-300 ${k.kind === kind ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}
                    >
                      {labelKind(k.kind)}
                    </button>
                    <span className="text-slate-400 font-mono">{k.count}</span>
                  </div>
                  <MiniBar value={k.count} max={maxByKind} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Top rotas
            </p>
            <div className="space-y-1.5 text-xs">
              {summary.byRoute.length === 0 && (
                <p className="text-slate-500">—</p>
              )}
              {summary.byRoute.slice(0, 10).map((r) => (
                <button
                  key={r.route}
                  type="button"
                  onClick={() => setRoute(r.route === route ? '' : r.route)}
                  className={`w-full flex justify-between hover:text-emerald-300 ${r.route === route ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}
                >
                  <span className="font-mono truncate">{r.route}</span>
                  <span className="text-slate-400 ml-2">{r.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Top áreas / abas
            </p>
            <div className="space-y-1.5 text-xs">
              {summary.byArea.length === 0 && (
                <p className="text-slate-500">—</p>
              )}
              {summary.byArea.slice(0, 10).map((a) => (
                <button
                  key={a.area}
                  type="button"
                  onClick={() => setArea(a.area === area ? '' : a.area)}
                  className={`w-full flex justify-between hover:text-emerald-300 ${a.area === area ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}
                >
                  <span className="truncate">{a.area}</span>
                  <span className="text-slate-400 ml-2">{a.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Top motivos
            </p>
            <div className="space-y-1.5 text-xs">
              {summary.byReason.length === 0 && (
                <p className="text-slate-500">—</p>
              )}
              {summary.byReason.slice(0, 10).map((r, i) => (
                <button
                  key={`${r.kind}-${r.reason}-${i}`}
                  type="button"
                  onClick={() => {
                    setKind(r.kind);
                    setReason(r.reason === reason ? '' : r.reason);
                  }}
                  className="w-full flex justify-between hover:text-emerald-300 text-slate-300"
                >
                  <span className="truncate">
                    <span className="text-slate-500">{labelKind(r.kind)} ·</span>{' '}
                    {labelReason(r.reason)}
                  </span>
                  <span className="font-mono text-slate-400 ml-2">{r.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Usuários mais afetados
            </p>
            <div className="space-y-1.5 text-xs">
              {summary.topUsers.length === 0 && (
                <p className="text-slate-500">—</p>
              )}
              {summary.topUsers.map((u) => (
                <button
                  key={u.userId}
                  type="button"
                  onClick={() => setUserId(u.userId === userId ? '' : u.userId)}
                  className={`w-full flex justify-between hover:text-emerald-300 ${u.userId === userId ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}
                >
                  <span className="font-mono truncate">{u.userId.slice(0, 12)}…</span>
                  <span className="text-slate-400 ml-2">{u.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {summary && summary.hourly.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Linha do tempo (por hora)
          </p>
          <HourlyChart data={summary.hourly} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={surface}
          onChange={(e) => setSurface(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
        >
          <option value="">Todas as áreas</option>
          <option value="player">Jogo / usuário</option>
          <option value="admin">Admin</option>
          <option value="public">Público</option>
        </select>
        <AdminInput
          placeholder="Rota (/club/wallet)"
          value={route}
          onChange={(e) => setRoute(e.target.value)}
          className="w-48"
        />
        {kind && (
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3 py-1 flex items-center gap-2">
            tipo: {labelKind(kind)}
            <button type="button" onClick={() => setKind('')} className="text-emerald-200/70">×</button>
          </span>
        )}
        {reason && (
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3 py-1 flex items-center gap-2">
            motivo: {labelReason(reason)}
            <button type="button" onClick={() => setReason('')} className="text-emerald-200/70">×</button>
          </span>
        )}
        {area && (
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3 py-1 flex items-center gap-2">
            área: {area}
            <button type="button" onClick={() => setArea('')} className="text-emerald-200/70">×</button>
          </span>
        )}
        <AdminInput
          placeholder="userId"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-48"
        />
        {userId && (
          <button type="button" onClick={() => setUserId('')} className="text-xs text-slate-400">
            limpar usuário
          </button>
        )}
      </div>

      {/* Items list */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] divide-y divide-white/[0.05]">
        {items.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            {loading ? 'Carregando…' : 'Nenhuma falha encontrada no período/filtro.'}
          </div>
        )}
        {items.map((item) => {
          const isOpen = expanded === item.id;
          return (
            <div key={item.id} className="p-3 hover:bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : item.id)}
                className="w-full text-left flex items-start gap-3"
              >
                <div className="text-[10px] text-slate-500 font-mono whitespace-nowrap pt-0.5">
                  {new Date(item.ts).toLocaleString('pt-BR')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 font-semibold">
                      {labelKind(item.kind)}
                    </span>
                    <span className="text-slate-200">{labelReason(item.reason)}</span>
                    {(item.route || item.tab) && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        {item.route ?? '—'}
                        {item.tab ? ` · ${item.tab}` : ''}
                      </span>
                    )}
                    {item.surface && (
                      <span className="rounded-full bg-white/[0.05] border border-white/10 text-slate-400 px-2 py-0.5 text-[10px]">
                        {labelSurface(item.surface)}
                      </span>
                    )}
                    {item.adminLogin && (
                      <span className="font-mono text-[10px] text-slate-500">
                        admin: {item.adminLogin}
                      </span>
                    )}
                    {item.userId && (
                      <span className="font-mono text-[10px] text-slate-500">
                        user: {item.userId.slice(0, 12)}…
                      </span>
                    )}
                  </div>
                  {item.message && (
                    <div className="text-xs text-slate-400 mt-1 truncate">{item.message}</div>
                  )}
                </div>
                <span className="text-slate-500 text-xs">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <pre className="mt-3 ml-24 text-[11px] text-slate-300 bg-black/30 rounded-lg p-3 overflow-x-auto">
                  {JSON.stringify(
                    {
                      ip: item.ip,
                      userAgent: item.userAgent,
                      context: item.context,
                    },
                    null,
                    2,
                  )}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
