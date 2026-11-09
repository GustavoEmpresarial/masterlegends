import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminForecastDTO, AdminLedgerRowDTO, AdminReportSummaryDTO } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminPageHeader, AdminTable } from '../../../components/admin/AdminTable';
import { adminPt, formatAdminDate } from '../../../lib/admin/i18n';

const REFRESH_MS = 30_000;

interface RecheckResponse {
  status: string;
  txHash?: string;
  amountUsdc?: number;
  type?: string;
  createdAt?: string;
  user?: string | null;
  fromWallet?: string;
  hint?: string;
}

function describeRecheck(r: RecheckResponse): string {
  switch (r.status) {
    case 'already_recorded':
      return `Já está no relatório (${r.amountUsdc?.toFixed(2)} USDC) — ${r.user ?? '?'} em ${r.createdAt ? formatAdminDate(r.createdAt) : '—'}`;
    case 'queued':
      return `↻ Enfileirado para reprocessamento (${r.amountUsdc?.toFixed(2)} USDC → ${r.user}). Aguarde alguns segundos e atualize.`;
    case 'wallet_not_linked':
      return `Nenhum usuário tem a carteira ${r.fromWallet?.slice(0, 8)}… vinculada. ${r.hint ?? ''}`;
    case 'tx_not_found': return 'TX não encontrada na blockchain (não confirmada ainda?)';
    case 'tx_failed': return 'TX falhou on-chain';
    case 'not_a_usdc_transfer': return 'Esta TX não é uma transferência USDC';
    case 'not_to_treasury': return 'A TX é USDC mas não foi para o vault do jogo';
    case 'config_missing': return 'Endereços de vault/USDC não configurados no .env';
    case 'rpc_unavailable': return 'POLYGON_RPC_URL não configurado';
    case 'redis_unavailable': return 'Redis indisponível';
    default: return `Status: ${r.status}`;
  }
}

function fmt(n: number, d = 2) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 0.01);
  const w = 200, h = 40;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity={0.8} />
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity={0.08} stroke="none" />
    </svg>
  );
}

function SummaryCard({ label, value, sub, icon, accent, sparkData }: {
  label: string; value: string; sub?: string; icon: string;
  accent: string; sparkData?: number[];
}) {
  const cls: Record<string, string> = {
    emerald: 'border-emerald-500/25 text-emerald-300',
    red:     'border-red-500/25 text-red-300',
    sky:     'border-sky-500/25 text-sky-300',
    amber:   'border-amber-500/25 text-amber-300',
    purple:  'border-purple-500/25 text-purple-300',
    cyan:    'border-cyan-500/25 text-cyan-300',
    slate:   'border-slate-500/25 text-slate-300',
  };
  const sparkColor: Record<string, string> = {
    emerald: '#34d399', red: '#f87171', sky: '#38bdf8', amber: '#fbbf24', purple: '#a78bfa', cyan: '#22d3ee', slate: '#94a3b8',
  };
  return (
    <div className={`rounded-xl border bg-white/[0.025] p-4 ${cls[accent] ?? cls.slate}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <i className={`bi ${icon} text-sm opacity-60`} />
      </div>
      <p className="text-xl font-bold tracking-tight text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      {sparkData && sparkData.length > 1 && (
        <div className="mt-3">
          <Sparkline data={sparkData} color={sparkColor[accent] ?? '#94a3b8'} />
        </div>
      )}
    </div>
  );
}

function ConfidenceBar({ pct }: { pct: number }) {
  const color = pct >= 75 ? '#34d399' : pct >= 45 ? '#fbbf24' : '#f87171';
  const label = pct >= 75 ? 'Alta' : pct >= 45 ? 'Média' : 'Baixa';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct.toFixed(0)}%`, background: color }} />
      </div>
      <span className="text-[10px] font-semibold" style={{ color }}>{label} ({pct.toFixed(0)}%)</span>
    </div>
  );
}

function MethodRow({ label, daily, days7, days30, color }: {
  label: string; daily: number; days7: number; days30: number; color: string;
}) {
  return (
    <tr className="border-b border-white/[0.04] last:border-0">
      <td className="py-2 pr-4 text-xs text-slate-400">{label}</td>
      <td className="py-2 pr-4 text-right font-mono text-xs" style={{ color }}>${fmt(daily)}/dia</td>
      <td className="py-2 pr-4 text-right font-mono text-sm font-semibold text-white">${fmt(days7)}</td>
      <td className="py-2 text-right font-mono text-sm font-semibold text-white">${fmt(days30)}</td>
    </tr>
  );
}

function ForecastBlock({ title, fc, accent }: { title: string; fc: AdminForecastDTO; accent: string }) {
  const borderCls = accent === 'emerald' ? 'border-emerald-500/20' : 'border-red-500/20';
  const textCls   = accent === 'emerald' ? 'text-emerald-400' : 'text-red-400';
  const color     = accent === 'emerald' ? '#34d399' : '#f87171';
  return (
    <div className={`rounded-xl border bg-white/[0.02] p-4 space-y-3 ${borderCls}`}>
      <div className="flex items-center justify-between">
        <h4 className={`text-[11px] font-bold uppercase tracking-wider ${textCls}`}>{title}</h4>
        <span className="text-[10px] text-slate-500">
          {fc.activeDays} dias ativos / {fc.zeroDays} sem transação (últimos 30d)
        </span>
      </div>

      {/* Best estimate headline */}
      <div className="flex gap-4">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Melhor estimativa 7d</p>
          <p className="text-2xl font-bold text-white">${fmt(fc.best7d)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Melhor estimativa 30d</p>
          <p className="text-2xl font-bold text-white">${fmt(fc.best30d)}</p>
        </div>
      </div>

      {/* Confidence */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Confiança (consenso entre métodos)</p>
        <ConfidenceBar pct={fc.confidencePct} />
      </div>

      {/* Methods breakdown */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Detalhamento por método</p>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="pb-1 text-left text-[9px] text-slate-600 uppercase tracking-wider">Método</th>
              <th className="pb-1 text-right text-[9px] text-slate-600 uppercase tracking-wider">Média/dia</th>
              <th className="pb-1 text-right text-[9px] text-slate-600 uppercase tracking-wider">7 dias</th>
              <th className="pb-1 text-right text-[9px] text-slate-600 uppercase tracking-wider">30 dias</th>
            </tr>
          </thead>
          <tbody>
            <MethodRow
              label="Mediana diária × taxa atividade"
              daily={fc.medianDaily} days7={fc.medianDaily * 7} days30={fc.medianDaily * 30} color={color} />
            <MethodRow
              label="Média aparada 10% × taxa atividade"
              daily={fc.trimmedMeanDaily} days7={fc.best7d} days30={fc.best30d} color={color} />
            <MethodRow
              label="EWMA ponderado (recente > antigo)"
              daily={fc.ewmaDaily} days7={fc.ewmaDaily * 7} days30={fc.ewmaDaily * 30} color={color} />
          </tbody>
        </table>
        <p className="text-[9px] text-slate-600 mt-1">
          <i className="bi bi-check-lg" aria-hidden /> = método usado como estimativa principal. EWMA λ=0.85 — dias recentes pesam ~5× mais que há 14 dias.
          Média aparada remove os 10% maiores e 10% menores picos antes de calcular.
        </p>
      </div>
    </div>
  );
}

function ForecastPanel({ deposits, withdrawals, onHide }: {
  deposits: AdminForecastDTO; withdrawals: AdminForecastDTO; onHide: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          <i className="bi bi-graph-up-arrow" aria-hidden /> Previsão — baseada nos últimos 30 dias
        </h3>
        <button type="button" onClick={onHide} className="text-slate-600 hover:text-slate-400">
          <i className="bi bi-x-lg text-xs" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ForecastBlock title="Depósitos" fc={deposits} accent="emerald" />
        <ForecastBlock title="Saques" fc={withdrawals} accent="red" />
      </div>
    </div>
  );
}

export function AdminReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [summary, setSummary] = useState<AdminReportSummaryDTO | null>(null);
  const [tab, setTab] = useState<'deposits' | 'withdrawals'>('deposits');
  const [rows, setRows] = useState<AdminLedgerRowDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [recheckTx, setRecheckTx] = useState('');
  const [recheckResult, setRecheckResult] = useState('');
  const [rechecking, setRechecking] = useState(false);
  const [showForecast, setShowForecast] = useState(true);
  const t = adminPt.reports;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { limit: '100' };
    if (from) params.from = from;
    if (to) params.to = to;
    if (search) params.search = search;
    try {
      const [sumRes, listRes] = await Promise.all([
        adminClient.get<AdminReportSummaryDTO>('/reports/summary', { params }),
        adminClient.get<{ transactions: AdminLedgerRowDTO[] }>(
          tab === 'deposits' ? '/reports/deposits' : '/reports/withdrawals',
          { params },
        ),
      ]);
      setSummary(sumRes.data);
      setRows(listRes.data.transactions);
      setLastFetchedAt(new Date());
    } finally {
      setLoading(false);
    }
  }, [from, to, tab, search]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) intervalRef.current = setInterval(() => void load(), REFRESH_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, load]);

  async function recheck() {
    if (!recheckTx.trim()) return;
    setRechecking(true);
    setRecheckResult('Consultando blockchain…');
    try {
      const { data } = await adminClient.post<RecheckResponse>('/reports/recheck-deposit', { txHash: recheckTx.trim() });
      setRecheckResult(describeRecheck(data));
      if (data.status === 'queued') setTimeout(() => void load(), 8000);
    } catch (err: unknown) {
      setRecheckResult(`${err instanceof Error ? err.message : 'Erro'}`);
    } finally {
      setRechecking(false);
    }
  }

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-emerald-500" />
              Auto 30s
            </label>
            {lastFetchedAt && <span className="text-[10px] text-slate-500">{lastFetchedAt.toLocaleTimeString('pt-BR')}</span>}
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.08]">
              <i className="bi bi-arrow-clockwise" /> Atualizar
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-4">
        {/* Date range + search */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">De</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Até</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Buscar usuário</label>
            <div className="relative flex gap-2">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                placeholder="nome, e-mail ou ID…"
                className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none"
              />
              <button type="button" onClick={applySearch}
                className="rounded-lg bg-emerald-700 hover:bg-emerald-600 px-3 py-2 text-sm text-white">
                <i className="bi bi-search" />
              </button>
              {search && (
                <button type="button" onClick={clearSearch}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-slate-400 hover:text-slate-200">
                  <i className="bi bi-x" />
                </button>
              )}
            </div>
          </div>
          <button type="button" onClick={() => { setFrom(''); setTo(''); clearSearch(); }}
            className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.06]">
            Limpar tudo
          </button>
        </div>

        {search && (
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
            <i className="bi bi-funnel-fill" />
            Filtrando por: <strong>{search}</strong>
            <button type="button" onClick={clearSearch} className="ml-1 text-emerald-400 hover:text-white"><i className="bi bi-x" /></button>
          </div>
        )}

        {/* Recheck deposit */}
        <div className="border-t border-white/[0.06] pt-3">
          <p className="text-[11px] text-slate-400 mb-2">
            <i className="bi bi-search" aria-hidden /> <strong>Depósito sumido?</strong> Cole o hash da TX para verificar/reprocessar.
          </p>
          <div className="flex flex-wrap gap-2">
            <input value={recheckTx} onChange={(e) => setRecheckTx(e.target.value)} placeholder="0xabc123…"
              className="flex-1 min-w-[260px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:border-sky-500/40 focus:outline-none" />
            <button type="button" disabled={rechecking || !recheckTx.trim()} onClick={() => void recheck()}
              className="rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-40 px-4 py-2 text-sm text-white">
              {rechecking ? '…' : <><i className="bi bi-search" aria-hidden /> Verificar TX</>}
            </button>
          </div>
          {recheckResult && (
            <p className="text-xs text-slate-200 mt-2 font-mono bg-black/30 border border-white/[0.06] rounded-lg p-2">{recheckResult}</p>
          )}
        </div>
      </div>

      {/* Summary grid */}
      {summary && (
        <div className="space-y-4">
          {/* Core financials */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <SummaryCard label="Depósitos" value={`$${fmt(summary.depositVolumeUsdc)}`}
              sub={`${summary.depositCount} transações`} icon="bi-arrow-down-circle-fill" accent="emerald"
              sparkData={summary.dailyDeposits.map(d => d.volume)} />
            <SummaryCard label="Saques" value={`$${fmt(summary.withdrawalVolumeUsdc)}`}
              sub={`${summary.withdrawalCount} transações`} icon="bi-arrow-up-circle-fill" accent="red"
              sparkData={summary.dailyWithdrawals.map(d => d.volume)} />
            <SummaryCard label="Saldo líquido" value={`$${fmt(summary.netUsdc)}`}
              sub="depósitos − saques" icon="bi-bar-chart-fill" accent={summary.netUsdc >= 0 ? 'sky' : 'amber'} />
            <SummaryCard label="Média dep." value={`$${fmt(summary.avgDepositUsdc)}`}
              sub={`mediana $${fmt(summary.medianDepositUsdc)}`} icon="bi-receipt" accent="cyan" />
            <SummaryCard label="Depositadores únicos" value={summary.uniqueDepositors.toString()}
              sub={`${summary.uniqueWithdrawers} sacaram`} icon="bi-people-fill" accent="purple" />
            <SummaryCard label="Média saque" value={`$${fmt(summary.avgWithdrawalUsdc)}`}
              sub={`mediana $${fmt(summary.medianWithdrawalUsdc)}`} icon="bi-cash-stack" accent="amber" />
          </div>

          {/* Forecasts */}
          {showForecast && (
            <ForecastPanel
              deposits={summary.forecastDeposits}
              withdrawals={summary.forecastWithdrawals}
              onHide={() => setShowForecast(false)}
            />
          )}

          {!showForecast && (
            <button type="button" onClick={() => setShowForecast(true)}
              className="text-xs text-slate-500 hover:text-slate-300">
              <i className="bi bi-graph-up-arrow mr-1" />Mostrar previsões
            </button>
          )}

          {/* Top depositors */}
          {summary.topDepositors.length > 0 && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                <i className="bi bi-trophy-fill" aria-hidden /> Top depositadores (período selecionado)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.05]">
                      <th className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">#</th>
                      <th className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Usuário</th>
                      <th className="pb-2 pr-4 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total</th>
                      <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Txs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topDepositors.map((u, i) => (
                      <tr key={u.userId} className="border-b border-white/[0.03] last:border-0">
                        <td className="py-2 pr-4 text-slate-500 text-xs">{i + 1}</td>
                        <td className="py-2 pr-4">
                          <div className="text-sm text-slate-200">{u.username ?? u.email ?? u.userId.slice(0, 8)}</div>
                          {u.username && u.email && <div className="text-xs text-slate-500">{u.email}</div>}
                        </td>
                        <td className="py-2 pr-4 text-right font-mono font-bold text-emerald-300">${fmt(u.total)}</td>
                        <td className="py-2 text-right text-slate-400 text-xs">{u.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transaction list */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          {(['deposits', 'withdrawals'] as const).map((key) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === key ? 'bg-emerald-700 text-white' : 'border border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
              }`}>
              {key === 'deposits' ? <><i className="bi bi-download" aria-hidden /> {t.deposits}</> : <><i className="bi bi-upload" aria-hidden /> {t.withdrawals}</>}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">
            {rows.length} de {tab === 'deposits' ? summary?.depositCount ?? 0 : summary?.withdrawalCount ?? 0}
          </span>
        </div>

        <AdminTable
          loading={loading}
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            {
              key: 'user',
              header: adminPt.user,
              render: (r) => (
                <div>
                  <div className="text-sm text-slate-200">{r.username ?? r.email ?? r.userId.slice(0, 8)}</div>
                  {r.username && r.email && <div className="text-xs text-slate-500">{r.email}</div>}
                </div>
              ),
            },
            {
              key: 'amount',
              header: adminPt.amount,
              render: (r) => (
                <span className="font-mono font-bold text-emerald-300">
                  ${r.amountUsdc.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </span>
              ),
            },
            {
              key: 'tx',
              header: t.tx,
              render: (r) => r.txHash?.startsWith('0x') ? (
                <a href={`https://polygonscan.com/tx/${r.txHash}`} target="_blank" rel="noreferrer"
                  className="font-mono text-xs text-sky-400 hover:underline">
                  {r.txHash.slice(0, 10)}…{r.txHash.slice(-6)}
                </a>
              ) : r.txHash ? (
                <span className="font-mono text-xs text-emerald-300">{r.txHash.slice(0, 10)}…{r.txHash.slice(-6)}</span>
              ) : <span className="text-slate-600">—</span>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) => (
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                  r.status === 'confirmed' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' :
                  r.status === 'pending'   ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' :
                                             'border-red-500/25 bg-red-500/10 text-red-300'
                }`}>
                  {r.status}
                </span>
              ),
            },
            {
              key: 'when',
              header: adminPt.when,
              render: (r) => <span className="text-xs text-slate-400">{formatAdminDate(r.createdAt)}</span>,
            },
          ]}
        />
      </div>
    </div>
  );
}
