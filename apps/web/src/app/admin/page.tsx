import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AdminOverviewDTO } from '@mll/shared';
import { adminClient } from '../../lib/api/adminClient';
import { AdminPageHeader } from '../../components/admin/AdminTable';
import { adminPt, withdrawalStatusLabel } from '../../lib/admin/i18n';

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtInt(n: number) {
  return n.toLocaleString('pt-BR');
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora mesmo';
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function statusDot(status: string): string {
  if (status === 'pending') return '#eab308';
  if (status === 'completed') return '#22c55e';
  if (status === 'rejected') return '#ef4444';
  if (status === 'cancelled') return '#94a3b8';
  return '#94a3b8';
}

interface StatProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  accent: 'emerald' | 'sky' | 'amber' | 'rose' | 'purple' | 'cyan' | 'slate';
  alert?: boolean;
}

const ACCENT_MAP: Record<StatProps['accent'], { card: string; icon: string; value: string }> = {
  emerald: { card: 'border-emerald-500/20 hover:border-emerald-500/35', icon: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', value: 'text-emerald-300' },
  sky:     { card: 'border-sky-500/20 hover:border-sky-500/35',         icon: 'bg-sky-500/10 border-sky-500/20 text-sky-400',         value: 'text-sky-300' },
  amber:   { card: 'border-amber-500/20 hover:border-amber-500/35',     icon: 'bg-amber-500/10 border-amber-500/20 text-amber-400',   value: 'text-amber-300' },
  rose:    { card: 'border-rose-500/20 hover:border-rose-500/35',       icon: 'bg-rose-500/10 border-rose-500/20 text-rose-400',     value: 'text-rose-300' },
  purple:  { card: 'border-purple-500/20 hover:border-purple-500/35',   icon: 'bg-purple-500/10 border-purple-500/20 text-purple-400', value: 'text-purple-300' },
  cyan:    { card: 'border-cyan-500/20 hover:border-cyan-500/35',       icon: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',     value: 'text-cyan-300' },
  slate:   { card: 'border-slate-500/20 hover:border-slate-500/35',     icon: 'bg-slate-500/10 border-slate-500/20 text-slate-400',  value: 'text-slate-300' },
};

function StatCard({ label, value, sub, icon, accent, alert }: StatProps) {
  const a = ACCENT_MAP[accent];
  return (
    <div className={`rounded-xl border bg-white/[0.03] p-5 transition-colors ${alert ? 'border-rose-500/40 bg-rose-500/5' : a.card}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${a.icon}`}>
          <i className={`bi ${icon} text-sm`} aria-hidden />
        </span>
      </div>
      <p className={`mt-3 text-2xl font-bold tracking-tight ${alert ? 'text-rose-300' : a.value}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
      <span className="h-px flex-1 bg-white/[0.06]" />
      {children}
      <span className="h-px flex-1 bg-white/[0.06]" />
    </h3>
  );
}

export function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverviewDTO | null>(null);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const t = adminPt.overview;

  async function load() {
    try {
      const res = await adminClient.get<AdminOverviewDTO>('/overview');
      setData(res.data);
      setLastRefresh(new Date());
    } catch {
      setError(t.loadError);
    }
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (error) {
    return (
      <>
        <AdminPageHeader title={t.title} subtitle={t.subtitle} />
        <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <AdminPageHeader title={t.title} subtitle={t.subtitle} />
        <p className="text-sm text-slate-400">{adminPt.loading}</p>
      </>
    );
  }

  const wd = data.withdrawalsCard;

  return (
    <>
      <AdminPageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-slate-500">
                Atualizado às {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/[0.08]"
            >
              <i className="bi bi-arrow-clockwise" />
              Atualizar
            </button>
          </div>
        }
      />

      <div className="space-y-8">

        <section>
          <SectionTitle><i className="bi bi-people-fill" aria-hidden /> Usuários</SectionTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Total de usuários" value={fmtInt(data.totalUsers)} icon="bi-people-fill" accent="sky" />
            <StatCard label="Novos hoje" value={fmtInt(data.newUsersToday)} sub="cadastros nas últimas 24h" icon="bi-person-plus-fill" accent="emerald" />
            <StatCard label="Novos em 7 dias" value={fmtInt(data.newUsers7d)} icon="bi-person-badge" accent="cyan" />
            <StatCard label="Com escalação" value={fmtInt(data.usersWithLineup)} sub="têm lineup salvo" icon="bi-diagram-3-fill" accent="purple" />
            <StatCard label="Banidos" value={fmtInt(data.bannedUsers)} icon="bi-person-x-fill" accent={data.bannedUsers > 0 ? 'rose' : 'slate'} alert={data.bannedUsers > 0} />
          </div>
        </section>

        <section>
          <SectionTitle><i className="bi bi-cash-stack" aria-hidden /> Financeiro</SectionTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            <StatCard label="USDC em jogo" value={`$${fmt(data.totalUsdcInGame)}`} sub="saldo acumulado na plataforma" icon="bi-bank2" accent="emerald" />
            <StatCard label="Depósitos hoje" value={`$${fmt(data.depositsTodayUsdc)}`} icon="bi-arrow-down-circle-fill" accent="emerald" />
            <StatCard label="Depósitos 7d" value={`$${fmt(data.deposits7dUsdc)}`} icon="bi-graph-up-arrow" accent="cyan" />
            <StatCard label="Saques hoje" value={`$${fmt(data.withdrawalsTodayUsdc)}`} icon="bi-arrow-up-circle-fill" accent="amber" />
            <StatCard label="Saques pendentes" value={fmtInt(data.pendingWithdrawals)} icon="bi-hourglass-split" accent={data.pendingWithdrawals > 0 ? 'amber' : 'slate'} alert={data.pendingWithdrawals > 5} />
          </div>
        </section>

        {wd && (
          <section>
            <SectionTitle><i className="bi bi-cash-coin" aria-hidden /> Saques</SectionTitle>
            <div className="rounded-xl border border-amber-500/20 bg-white/[0.03] p-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Hoje</p>
                  <p className="mt-1 text-xl font-bold text-slate-100">{fmtInt(wd.requestedToday)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Pendentes</p>
                  <p className="mt-1 text-xl font-bold text-amber-300">{fmtInt(wd.pending)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Pagos hoje</p>
                  <p className="mt-1 text-xl font-bold text-emerald-300">{fmtInt(wd.paidToday)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Rejeitados hoje</p>
                  <p className="mt-1 text-xl font-bold text-rose-300">{fmtInt(wd.rejectedToday)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Valor pago hoje</p>
                  <p className="mt-1 text-xl font-bold text-emerald-300">{fmt(wd.paidTodayUsdc)} USDT</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Valor pago no mês</p>
                  <p className="mt-1 text-xl font-bold text-sky-300">{fmt(wd.paidMonthUsdc)} USDT</p>
                </div>
              </div>

              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Últimos</p>
                {wd.recent.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum saque recente</p>
                ) : (
                  <ul className="space-y-2">
                    {wd.recent.map((r) => (
                      <li key={r.id} className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <span className="text-slate-500">
                          {new Date(r.createdAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="text-slate-200">{fmt(r.amountUsdc, 4)} {r.currency.toUpperCase()}</span>
                        <span className="text-slate-400">
                          <i className="bi bi-circle-fill" style={{ color: statusDot(r.status), fontSize: 8 }} aria-hidden /> {withdrawalStatusLabel(r.status)}
                        </span>
                        <span className="font-mono text-[11px] text-sky-400/80">
                          {r.txHash
                            ? `${r.txHash.slice(0, 8)}…${r.txHash.slice(-4)}`
                            : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  to="/admin/withdrawals/history"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/20"
                >
                  Ver Histórico Completo
                  <i className="bi bi-arrow-right" />
                </Link>
              </div>
            </div>
          </section>
        )}

        <section>
          <SectionTitle><i className="bi bi-hammer" aria-hidden /> Patrocínios / Mineração</SectionTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            <StatCard
              label="Último bloco"
              value={data.lastMiningBlockNumber ? `#${fmtInt(data.lastMiningBlockNumber)}` : '—'}
              sub={timeAgo(data.lastMiningBlockAt)}
              icon="bi-box-seam-fill"
              accent="purple"
            />
            <StatCard label="Participantes (último bloco)" value={fmtInt(data.miningParticipantsLastBlock)} icon="bi-trophy-fill" accent="cyan" />
            <StatCard label="Total de blocos" value={fmtInt(data.totalMiningBlocksAllTime)} icon="bi-stack" accent="sky" />
            <StatCard
              label="Status mineração"
              value={data.miningPaused ? 'PAUSADA' : 'ATIVA'}
              icon={data.miningPaused ? 'bi-pause-circle-fill' : 'bi-play-circle-fill'}
              accent={data.miningPaused ? 'rose' : 'emerald'}
              alert={data.miningPaused}
            />
          </div>
        </section>

        <section>
          <SectionTitle><i className="bi bi-controller" aria-hidden /> Jogo</SectionTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            <StatCard label="Tickets abertos" value={fmtInt(data.openTickets)} icon="bi-headset" accent={data.openTickets > 10 ? 'rose' : data.openTickets > 0 ? 'amber' : 'slate'} alert={data.openTickets > 20} />
            <StatCard label="Indicações totais" value={fmtInt(data.totalReferrals)} sub={`+${fmtInt(data.referrals7d)} em 7 dias`} icon="bi-share-fill" accent="emerald" />
            <StatCard label="Cards mintados" value={fmtInt(data.totalMints)} sub={`+${fmtInt(data.mints7d)} em 7 dias`} icon="bi-card-image" accent="purple" />
            <StatCard label="Passes ativos" value={fmtInt(data.activePasses)} icon="bi-ticket-perforated-fill" accent="cyan" />
          </div>
        </section>

      </div>
    </>
  );
}
