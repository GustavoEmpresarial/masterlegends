import { useEffect, useMemo, useRef, useState } from 'react';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminButton, AdminInput, AdminPageHeader } from '../../../components/admin/AdminTable';

interface LogEntryDTO {
  id: string; ts: string; level: string; service: string;
  event: string | null; msg: string | null;
  userId: string | null; jobId: string | null; meta: Record<string, unknown>;
}

interface LogStats {
  total: number;
  byLevel: Record<string, number>;
  byService: Record<string, number>;
}

// ─── Level helpers ────────────────────────────────────────────────────────────

const LEVEL_NUM: Record<string, number> = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };

function resolveLevel(raw: string): string {
  if (LEVEL_NUM[raw]) return raw;
  const n = Number(raw);
  if (n >= 60) return 'fatal';
  if (n >= 50) return 'error';
  if (n >= 40) return 'warn';
  if (n >= 30) return 'info';
  if (n >= 20) return 'debug';
  return 'trace';
}

const LEVEL_META: Record<string, { label: string; dot: string; badge: string; row: string }> = {
  trace:  { label: 'TRACE', dot: 'bg-slate-500',  badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20',   row: '' },
  debug:  { label: 'DEBUG', dot: 'bg-blue-500',   badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',      row: '' },
  info:   { label: 'INFO',  dot: 'bg-emerald-500',badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', row: '' },
  warn:   { label: 'WARN',  dot: 'bg-amber-400',  badge: 'bg-amber-400/10 text-amber-300 border-amber-400/20',   row: 'bg-amber-500/[0.03]' },
  error:  { label: 'ERROR', dot: 'bg-red-500',    badge: 'bg-red-500/10 text-red-400 border-red-500/20',          row: 'bg-red-500/[0.04]' },
  fatal:  { label: 'FATAL', dot: 'bg-red-700',    badge: 'bg-red-700/20 text-red-300 border-red-700/30',          row: 'bg-red-700/[0.06]' },
};

function LevelBadge({ raw }: { raw: string }) {
  const key = resolveLevel(raw);
  const m = LEVEL_META[key];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${m.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntryDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [level, setLevel] = useState('');
  const [service, setService] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(100);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit };
      if (level) params.level = level;
      if (service) params.service = service;
      if (q) params.q = q;
      const [{ data }, { data: s }] = await Promise.all([
        adminClient.get<{ logs: LogEntryDTO[]; total: number }>('/logs', { params }),
        adminClient.get<LogStats>('/logs/stats'),
      ]);
      setLogs(data.logs);
      setTotal(data.total);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchLogs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => void fetchLogs(), 5000);
    return () => clearInterval(t);
  }, [auto, level, service, q, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  const services = useMemo(() => Object.keys(stats?.byService ?? {}).sort(), [stats]);

  const levelOrder = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
  const byLevelSorted = stats
    ? levelOrder.filter((l) => {
        const num = LEVEL_NUM[l];
        return Object.entries(stats.byLevel).some(([k, v]) => resolveLevel(k) === l && v > 0);
      }).map((l) => ({
        key: l,
        count: Object.entries(stats.byLevel)
          .filter(([k]) => resolveLevel(k) === l)
          .reduce((s, [, v]) => s + v, 0),
      }))
    : [];

  const selectCls = 'rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/40 focus:outline-none appearance-none';

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Logs"
        subtitle={`MongoDB · ${total.toLocaleString()} no filtro · ${stats?.total.toLocaleString() ?? '–'} total`}
        actions={
          <div className="flex items-center gap-2">
            {auto && (
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ao vivo
              </span>
            )}
            <label
              className={`flex items-center gap-2 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${auto ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-slate-200'}`}
              onClick={() => setAuto((a) => !a)}
            >
              <i className={`bi ${auto ? 'bi-pause-fill' : 'bi-arrow-repeat'} text-xs`} />
              Auto 5s
            </label>
            <AdminButton size="sm" onClick={() => void fetchLogs()} disabled={loading}>
              {loading ? <><i className="bi bi-arrow-repeat animate-spin text-xs" /> Buscando…</> : <><i className="bi bi-search text-xs" /> Buscar</>}
            </AdminButton>
          </div>
        }
      />

      {/* Level stat cards */}
      {byLevelSorted.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byLevelSorted.map(({ key, count }) => {
            const m = LEVEL_META[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setLevel(level === key ? '' : key); }}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-colors ${
                  level === key
                    ? `${m.badge} border-opacity-60`
                    : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                <span className="text-xs font-bold">{m.label}</span>
                <span className="text-sm font-bold">{count.toLocaleString()}</span>
              </button>
            );
          })}
          {(level || service || q) && (
            <button
              type="button"
              onClick={() => { setLevel(''); setService(''); setQ(''); }}
              className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-slate-500 hover:text-slate-200"
            >
              <i className="bi bi-x text-sm" /> Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="admin-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500 font-medium">Nível</p>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectCls}>
              <option value="">Todos</option>
              {['trace', 'debug', 'info', 'warn', 'error', 'fatal'].map((l) => (
                <option key={l} value={l}>{l.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500 font-medium">Serviço</p>
            <select value={service} onChange={(e) => setService(e.target.value)} className={selectCls}>
              <option value="">Todos</option>
              {services.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <p className="text-xs text-slate-500 font-medium">Busca livre (msg ou event)</p>
            <AdminInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ex: treasury_poll, Socket connected…"
              onKeyDown={(e) => { if (e.key === 'Enter') void fetchLogs(); }}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500 font-medium">Limite</p>
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={`${selectCls} w-24`}>
              {[50, 100, 250, 500].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Log table */}
      <div className="admin-card overflow-hidden p-0">
        {/* Header */}
        <div className="grid grid-cols-[160px_90px_80px_1fr] gap-0 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
          {['Timestamp', 'Nível', 'Serviço', 'Mensagem'].map((h) => (
            <p key={h} className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</p>
          ))}
        </div>

        <div ref={listRef} className="max-h-[62vh] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <i className="bi bi-journal-x text-3xl text-slate-700 mb-3" />
              <p className="text-sm text-slate-500">Nenhum log encontrado.</p>
            </div>
          ) : (
            logs.map((l) => {
              const key = resolveLevel(l.level);
              const m = LEVEL_META[key];
              const isOpen = expanded === l.id;
              const ts = new Date(l.ts);
              const hasExtra = l.userId || l.jobId || Object.keys(l.meta ?? {}).length > 0;

              return (
                <div key={l.id} className={`border-b border-white/[0.04] last:border-0 ${m.row}`}>
                  <button
                    type="button"
                    onClick={() => hasExtra && setExpanded(isOpen ? null : l.id)}
                    className={`w-full grid grid-cols-[160px_90px_80px_1fr] gap-0 px-4 py-2.5 text-left text-xs transition-colors ${hasExtra ? 'hover:bg-white/[0.02] cursor-pointer' : 'cursor-default'}`}
                  >
                    {/* Timestamp */}
                    <div className="text-slate-500 tabular-nums font-mono text-[11px] flex items-center">
                      {ts.toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </div>

                    {/* Level */}
                    <div className="flex items-center">
                      <LevelBadge raw={l.level} />
                    </div>

                    {/* Service */}
                    <div className="flex items-center">
                      <span className="rounded-md bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                        {l.service}
                      </span>
                    </div>

                    {/* Message */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {l.event && (
                        <span className="shrink-0 text-purple-400 font-mono text-[10px]">{l.event}</span>
                      )}
                      {l.event && l.msg && <span className="text-slate-700">·</span>}
                      {l.msg && (
                        <span className={`truncate text-[11px] ${key === 'error' || key === 'fatal' ? 'text-red-300' : key === 'warn' ? 'text-amber-300' : 'text-slate-300'}`}>
                          {l.msg}
                        </span>
                      )}
                      {hasExtra && (
                        <i className={`bi ${isOpen ? 'bi-chevron-up' : 'bi-chevron-down'} text-[9px] text-slate-600 ml-auto shrink-0`} />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/[0.04] bg-[#060d14] px-4 py-3">
                      <pre className="text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                        {JSON.stringify({ userId: l.userId, jobId: l.jobId, ...l.meta }, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {logs.length > 0 && (
          <div className="border-t border-white/[0.04] bg-white/[0.01] px-4 py-2 flex items-center justify-between">
            <p className="text-[10px] text-slate-600">
              Exibindo {logs.length.toLocaleString()} de {total.toLocaleString()} registros
            </p>
            <button
              type="button"
              onClick={() => listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-[10px] text-slate-600 hover:text-slate-300 flex items-center gap-1"
            >
              <i className="bi bi-arrow-up text-[9px]" /> Topo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
