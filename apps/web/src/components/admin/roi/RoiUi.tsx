import type { ReactNode } from 'react';
import type { AdminPlatformRoiDTO, AdminRoiAlertLevel, AdminRoiAuditCheckDTO, AdminUserRoiDTO } from '@mll/shared';
import { Link } from 'react-router-dom';
import { AdminTable } from '../AdminTable';
import { formatAdminDate } from '../../../lib/admin/i18n';

export function fmtUsdc(n: number, d?: number) {
  const decimals =
    d ??
    (Math.abs(n) < 0.0001 ? 6 : Math.abs(n) < 0.01 ? 4 : Math.abs(n) < 1 ? 4 : 2);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Cota por rodada — sempre 4 casas para não arredondar 0,0075 → 0,01 */
export function fmtRodada(n: number) {
  return fmtUsdc(n, 4);
}

export function fmtPct(n: number | null | undefined, d = 2) {
  if (n == null) return '—';
  return `${fmtUsdc(n, d)}%`;
}

export function AlertBadge({ level, compact }: { level: AdminRoiAlertLevel; compact?: boolean }) {
  const cfg = {
    ok: { cls: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25', label: 'Saudável', icon: 'bi-check-circle' },
    warning: { cls: 'bg-amber-500/12 text-amber-300 border-amber-500/25', label: 'Atenção', icon: 'bi-exclamation-triangle' },
    critical: { cls: 'bg-red-500/12 text-red-300 border-red-500/25', label: 'Crítico', icon: 'bi-shield-exclamation' },
  }[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold ${cfg.cls} ${compact ? 'text-[10px]' : 'text-xs'}`}>
      <i className={`bi ${cfg.icon}`} aria-hidden />
      {cfg.label}
    </span>
  );
}

export function LiveIndicator({ lastSync, refreshing }: { lastSync: Date | null; refreshing: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${refreshing ? 'animate-ping bg-emerald-400' : 'bg-emerald-500/40'}`} />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <span>
        {refreshing ? 'Atualizando…' : lastSync ? `Ao vivo · ${lastSync.toLocaleTimeString('pt-BR')}` : 'Conectando…'}
      </span>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = 'slate',
  large,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: string;
  accent?: 'emerald' | 'sky' | 'amber' | 'purple' | 'red' | 'slate';
  large?: boolean;
}) {
  const ring: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-transparent border-emerald-500/20',
    sky: 'from-sky-500/20 to-transparent border-sky-500/20',
    amber: 'from-amber-500/20 to-transparent border-amber-500/20',
    purple: 'from-purple-500/20 to-transparent border-purple-500/20',
    red: 'from-red-500/20 to-transparent border-red-500/20',
    slate: 'from-white/5 to-transparent border-white/10',
  };
  const text: Record<string, string> = {
    emerald: 'text-emerald-300',
    sky: 'text-sky-300',
    amber: 'text-amber-300',
    purple: 'text-purple-300',
    red: 'text-red-300',
    slate: 'text-slate-300',
  };
  return (
    <div className={`admin-card relative overflow-hidden border bg-gradient-to-br p-4 ${ring[accent]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <i className={`bi ${icon} text-base opacity-50 ${text[accent]}`} aria-hidden />
      </div>
      <p className={`mt-2 font-bold tracking-tight text-white ${large ? 'text-2xl sm:text-3xl' : 'text-xl'}`}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}

export function SectionCard({
  title,
  icon,
  action,
  children,
  className = '',
}: {
  title: string;
  icon: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-card overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2">
          <i className={`bi ${icon} text-sm text-emerald-400/80`} aria-hidden />
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function BarSegment({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-medium text-slate-200">{fmtUsdc(value)} USDC</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CapitalBreakdown({ platform }: { platform: AdminPlatformRoiDTO }) {
  const { capital } = platform;
  const inflow = capital.totalDepositsUsdc + capital.totalAdminCreditsUsdc;
  const outflow = capital.totalWithdrawalsUsdc + capital.totalAdminDebitsUsdc;
  const max = Math.max(inflow, outflow, capital.netCapitalInUsdc, 1);

  return (
    <div className="space-y-3">
      <BarSegment label="Depósitos on-chain" value={capital.totalDepositsUsdc} total={max} color="bg-sky-500" />
      <BarSegment label="Créditos admin" value={capital.totalAdminCreditsUsdc} total={max} color="bg-purple-500" />
      <BarSegment label="Saques" value={capital.totalWithdrawalsUsdc} total={max} color="bg-red-500/80" />
      <BarSegment label="Débitos admin" value={capital.totalAdminDebitsUsdc} total={max} color="bg-orange-500/80" />
      <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
        <span className="text-xs font-semibold text-emerald-300/90">Capital líquido na plataforma</span>
        <span className="text-sm font-bold text-white">{fmtUsdc(capital.netCapitalInUsdc)} USDC</span>
      </div>
    </div>
  );
}

export function MllConfigStrip({ platform }: { platform: AdminPlatformRoiDTO }) {
  const { config, roi, totals } = platform;
  const sinceLabel = platform.auditSinceAt
    ? new Date(platform.auditSinceAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : null;
  const items = [
    { label: 'Cota / rodada (config)', value: `${fmtRodada(config.miningBlockRewardUsdc)} USDT`, icon: 'bi-gem', highlight: true },
    { label: 'Intervalo', value: `${config.miningBlockIntervalMin} min`, icon: 'bi-clock' },
    { label: 'Rodadas / dia', value: String(Math.round(config.blocksPerDay)), icon: 'bi-calendar-day' },
    { label: 'Pool diário (config)', value: `${fmtUsdc(config.expectedDailyPoolUsdc)} USDT`, icon: 'bi-piggy-bank', highlight: true },
    {
      label: 'Média 24h (blocos)',
      value: `${fmtRodada(config.last24hAvgBlockRewardUsdc)} USDT`,
      icon: 'bi-graph-down',
    },
    { label: 'Miners no período', value: String(roi.minersCount), icon: 'bi-people' },
    { label: 'Depositantes', value: String(roi.depositorsCount), icon: 'bi-wallet2' },
    {
      label: sinceLabel ? `Blocos desde ${sinceLabel}` : 'Blocos no período',
      value: totals.blockCount.toLocaleString('pt-BR'),
      icon: 'bi-boxes',
    },
    {
      label: 'Patrocínios',
      value: config.miningPaused ? 'Pausado' : 'Ativo',
      icon: config.miningPaused ? 'bi-pause-circle' : 'bi-play-circle',
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div
          key={it.label}
          className={`rounded-lg border px-2.5 py-2 ${
            it.highlight
              ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
              : 'border-white/[0.06] bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
            <i className={`bi ${it.icon} text-xs`} aria-hidden />
            {it.label}
          </div>
          <p className={`mt-0.5 truncate text-sm font-semibold ${it.highlight ? 'text-emerald-300' : 'text-slate-200'}`}>
            {it.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function HealthChecks({ platform }: { platform: AdminPlatformRoiDTO }) {
  const { totals, config } = platform;
  const sinceLabel = platform.auditSinceAt
    ? new Date(platform.auditSinceAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : 'o corte';
  const checks = [
    {
      label: 'Cota atual vs blocos 24h',
      ok: config.last24hLegacyBlockCount === 0,
      value:
        config.last24hLegacyBlockCount === 0
          ? `${fmtRodada(config.miningBlockRewardUsdc)}/rodada`
          : `${config.last24hLegacyBlockCount} bloco(s) com cota antiga`,
      desc: `Média registrada: ${fmtRodada(config.last24hAvgBlockRewardUsdc)} · esperado: ${fmtRodada(config.miningBlockRewardUsdc)}`,
    },
    {
      label: `Pool vs pago (desde ${sinceLabel})`,
      ok: Math.abs(totals.poolVsDistributedDriftUsdc) <= 1,
      value: `Δ ${fmtUsdc(totals.poolVsDistributedDriftUsdc, 4)} USDT`,
      desc: `${fmtUsdc(totals.distributedUsdc)} distribuído / ${fmtUsdc(totals.historicalPoolUsdc)} registrado`,
    },
    {
      label: `Ledger vs rewards (desde ${sinceLabel})`,
      ok: Math.abs(totals.ledgerVsDistributedDriftUsdc) <= 0.5,
      value: `Δ ${fmtUsdc(totals.ledgerVsDistributedDriftUsdc, 4)} USDT`,
      desc: 'mining_claim no saldo vs MiningReward (só o período novo)',
    },
    {
      label: 'Últimas 24h (pago vs pool)',
      ok: Math.abs(totals.last24hDriftUsdc) <= 0.5,
      value: `Δ ${fmtUsdc(totals.last24hDriftUsdc, 4)} USDT`,
      desc: `${totals.last24hBlocks} rodadas · ${fmtUsdc(totals.last24hDistributedUsdc, 4)} pago · pool config ${fmtUsdc(config.last24hExpectedPoolAtCurrentRateUsdc, 4)}`,
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {checks.map((c) => (
        <div
          key={c.label}
          className={`flex gap-3 rounded-lg border px-3 py-2.5 ${
            c.ok ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-amber-500/25 bg-amber-500/[0.06]'
          }`}
        >
          <i
            className={`bi ${c.ok ? 'bi-check-circle-fill text-emerald-400' : 'bi-exclamation-diamond-fill text-amber-400'} mt-0.5 text-lg`}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200">{c.label}</p>
            <p className={`text-xs font-semibold ${c.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{c.value}</p>
            <p className="text-[11px] text-slate-500">{c.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuditChecksPanel({
  checks,
  level,
  blockRewardUsdc,
}: {
  checks: AdminRoiAuditCheckDTO[];
  level: AdminRoiAlertLevel;
  blockRewardUsdc?: number;
}) {
  const iconFor = (lv: AdminRoiAlertLevel) => {
    if (lv === 'critical') return { icon: 'bi-x-octagon-fill', ring: 'border-red-500/25 bg-red-500/[0.06]', text: 'text-red-300' };
    if (lv === 'warning') return { icon: 'bi-exclamation-triangle-fill', ring: 'border-amber-500/25 bg-amber-500/[0.06]', text: 'text-amber-300' };
    return { icon: 'bi-check-circle-fill', ring: 'border-emerald-500/25 bg-emerald-500/[0.06]', text: 'text-emerald-300' };
  };

  const issues = checks.filter((c) => c.level !== 'ok');
  const healthy = checks.filter((c) => c.level === 'ok');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <AlertBadge level={level} />
        {level === 'critical' && blockRewardUsdc != null && (
          <p className="text-xs text-slate-500">
            A cota <strong className="text-emerald-400/90">{fmtRodada(blockRewardUsdc)} USDT/rodada</strong> está
            correta — o alerta principal é inconsistência histórica no saldo vs blocos, não over-distribution.
          </p>
        )}
      </div>

      {issues.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Requer atenção</p>
          {issues.map((c) => {
            const st = iconFor(c.level);
            return (
              <div key={c.id} className={`flex gap-3 rounded-lg border px-3 py-3 ${st.ring}`}>
                <i className={`bi ${st.icon} mt-0.5 shrink-0 text-lg ${st.text}`} aria-hidden />
                <div>
                  <p className={`text-sm font-semibold ${st.text}`}>{c.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{c.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {healthy.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">OK</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {healthy.map((c) => {
              const st = iconFor(c.level);
              return (
                <div key={c.id} className={`rounded-lg border px-3 py-2.5 ${st.ring}`}>
                  <p className={`flex items-center gap-1.5 text-xs font-semibold ${st.text}`}>
                    <i className={`bi ${st.icon}`} aria-hidden />
                    {c.title}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{c.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function AlertsPanel({ alerts, level }: { alerts: string[]; level: AdminRoiAlertLevel }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <i className="bi bi-shield-check text-xl text-emerald-400" aria-hidden />
        <div>
          <p className="text-sm font-medium text-emerald-200">Economia consistente</p>
          <p className="text-xs text-slate-500">Patrocínios, ledger e capital batem dentro da tolerância.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <AlertBadge level={level} />
      <ul className="space-y-1.5">
        {alerts.map((a) => (
          <li key={a} className="flex gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-slate-300">
            <i className="bi bi-info-circle mt-0.5 shrink-0 text-slate-500" aria-hidden />
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlatformOverview({
  platform,
  onAuditUser,
}: {
  platform: AdminPlatformRoiDTO;
  onAuditUser: (userId: string) => void;
}) {
  const { roi, capital, totals, config } = platform;
  const sinceLabel = platform.auditSinceAt
    ? new Date(platform.auditSinceAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : null;

  return (
    <div className="space-y-5">
      <div className="admin-card relative overflow-hidden border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-sky-500/[0.04] p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/80">Master Legends League</p>
            <h2 className="text-xl font-bold text-white sm:text-2xl">ROI Geral · Patrocínios</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              Cota configurada:{' '}
              <strong className="text-emerald-300">{fmtRodada(config.miningBlockRewardUsdc)} USDT</strong> a cada{' '}
              {config.miningBlockIntervalMin} min ({fmtUsdc(config.expectedDailyPoolUsdc)} USDT/dia). Distribuição
              proporcional ao overwall em campo.
              {sinceLabel && (
                <>
                  {' '}
                  Auditoria de pool/extrato{' '}
                  <strong className="text-amber-200">desde {sinceLabel}</strong> (ignora divergência antiga).
                </>
              )}
            </p>
          </div>
          <AlertBadge level={platform.alertLevel} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            large
            accent="emerald"
            icon="bi-graph-up-arrow"
            label={sinceLabel ? `ROI desde ${sinceLabel}` : 'ROI no período'}
            value={fmtPct(roi.percentOnCapital)}
            hint={`${fmtUsdc(totals.distributedUsdc)} patrocínios ÷ ${fmtUsdc(capital.netCapitalInUsdc)} capital`}
          />
          <KpiCard
            large
            accent="sky"
            icon="bi-lightning-charge"
            label="ROI 24 horas"
            value={fmtPct(roi.dailyPercentOnCapital)}
            hint={`${fmtUsdc(totals.last24hDistributedUsdc)} em ${totals.last24hBlocks} blocos`}
          />
          <KpiCard
            large
            accent="purple"
            icon="bi-pie-chart"
            label={sinceLabel ? `Pool vs pago (desde ${sinceLabel})` : 'Pool vs pago'}
            value={fmtPct(roi.payoutVsPoolPercent)}
            hint={`${fmtUsdc(totals.distributedUsdc)} de ${fmtUsdc(totals.historicalPoolUsdc)} USDT (soma dos blocos)`}
          />
          <KpiCard
            large
            accent="amber"
            icon="bi-cash-stack"
            label="Pool diário (cota atual)"
            value={`${fmtUsdc(config.expectedDailyPoolUsdc)} USDT`}
            hint={`${fmtRodada(config.miningBlockRewardUsdc)}/rodada × ${Math.round(config.blocksPerDay)} rodadas`}
          />
        </div>
      </div>

      <SectionCard title="Configuração ao vivo" icon="bi-gear-wide-connected">
        <MllConfigStrip platform={platform} />
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Composição de capital" icon="bi-bank">
          <CapitalBreakdown platform={platform} />
        </SectionCard>
        <SectionCard title="Saúde da economia" icon="bi-heart-pulse">
          <HealthChecks platform={platform} />
        </SectionCard>
      </div>

      <SectionCard title="Diagnóstico MLL" icon="bi-clipboard2-pulse">
        <AuditChecksPanel
          checks={platform.auditChecks ?? []}
          level={platform.alertLevel}
          blockRewardUsdc={config.miningBlockRewardUsdc}
        />
      </SectionCard>

      {platform.topDrifts.length > 0 && (
        <SectionCard
          title={
            sinceLabel
              ? `Usuários — ledger vs blocos (desde ${sinceLabel})`
              : 'Usuários — ledger vs blocos'
          }
          icon="bi-bug"
          action={
            <span className="text-[10px] text-slate-500">Quem concentra a diferença neste período</span>
          }
        >
          <AdminTable
            rows={platform.topDrifts}
            rowKey={(u) => u.userId}
            columns={[
              {
                key: 'user',
                header: 'Usuário',
                render: (u) => (
                  <span className="font-medium text-slate-200">{u.username ?? u.email ?? u.userId.slice(0, 8)}</span>
                ),
              },
              {
                key: 'drift',
                header: 'Diferença',
                render: (u) => (
                  <span className={u.driftUsdc < 0 ? 'text-amber-300' : 'text-red-300'}>
                    {fmtUsdc(u.driftUsdc, 4)} USDT
                  </span>
                ),
              },
              {
                key: 'go',
                header: '',
                render: (u) => (
                  <button type="button" className="text-sm text-emerald-400 hover:text-emerald-300" onClick={() => onAuditUser(u.userId)}>
                    Ver usuário
                  </button>
                ),
              },
            ]}
          />
        </SectionCard>
      )}
    </div>
  );
}

export function UserDetailPanel({
  data,
  loading,
  onClose,
}: {
  data: AdminUserRoiDTO | null;
  loading: boolean;
  onClose?: () => void;
}) {
  if (loading) {
    return (
      <div className="admin-card flex min-h-[20rem] items-center justify-center p-8">
        <div className="text-center">
          <i className="bi bi-arrow-repeat mb-2 block animate-spin text-2xl text-emerald-400" aria-hidden />
          <p className="text-sm text-slate-400">Calculando ROI do usuário…</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="admin-card flex min-h-[20rem] flex-col items-center justify-center p-8 text-center">
        <i className="bi bi-person-lines-fill mb-3 text-4xl text-slate-600" aria-hidden />
        <p className="text-sm font-medium text-slate-400">Selecione um usuário na lista</p>
        <p className="mt-1 max-w-xs text-xs text-slate-600">Clique em uma linha para ver patrocínios, capital e ROI em tempo real.</p>
      </div>
    );
  }

  const display = data.username ?? data.email ?? 'Usuário';
  const roiDaily = data.mining.estimatedDailyUsdc;
  const roiMonthly = roiDaily * 30;

  return (
    <div className="admin-card overflow-hidden lg:sticky lg:top-20">
      <div className="border-b border-white/[0.06] bg-gradient-to-r from-emerald-500/[0.08] to-transparent px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-white">{display}</p>
            {data.email && data.username && <p className="truncate text-xs text-slate-500">{data.email}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AlertBadge level={data.roi.alertLevel} compact />
            {onClose && (
              <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Fechar">
                <i className="bi bi-x-lg" aria-hidden />
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase text-slate-500">ROI total</p>
            <p className="text-lg font-bold text-emerald-300">{fmtPct(data.roi.percentOnCapital)}</p>
          </div>
          <div className="rounded-lg bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase text-slate-500">ROI 24h</p>
            <p className="text-lg font-bold text-sky-300">{fmtPct(data.roi.dailyPercentOnCapital)}</p>
          </div>
        </div>
      </div>

      <div className="max-h-[calc(100vh-12rem)] space-y-4 overflow-y-auto p-4">
        {data.roi.alerts.length > 0 && <AlertsPanel alerts={data.roi.alerts} level={data.roi.alertLevel} />}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
            <p className="text-slate-500">Capital líquido</p>
            <p className="mt-0.5 font-bold text-white">{fmtUsdc(data.capital.netCapitalIn)} USDC</p>
            <p className="mt-1 text-[10px] text-slate-600">
              {data.capital.depositCount} dep. · {data.capital.adminCreditCount} créd. admin
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
            <p className="text-slate-500">Patrocínios</p>
            <p className="mt-0.5 font-bold text-emerald-300">{fmtUsdc(data.mining.totalPaidUsdc)} USDT</p>
            <p className="mt-1 text-[10px] text-slate-600">{data.mining.blocksParticipated} blocos</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
            <p className="text-slate-500">Saldo USDC</p>
            <p className="mt-0.5 font-bold text-white">{fmtUsdc(data.balances.currentUsdc)} USDC</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
            <p className="text-slate-500">Saldo USDT</p>
            <p className="mt-0.5 font-bold text-amber-300">{fmtUsdc(data.balances.currentUsdt)} USDT</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
            <p className="text-slate-500">Estimativa / dia</p>
            <p className="mt-0.5 font-bold text-amber-300">{fmtUsdc(roiDaily)} USDT</p>
            <p className="mt-1 text-[10px] text-slate-600">~{fmtUsdc(roiMonthly)}/mês</p>
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
          <p className="mb-2 font-semibold text-slate-300">Config MLL · patrocínios</p>
          <dl className="space-y-1.5">
            <div className="flex justify-between">
              <dt className="text-slate-500">Cota / rodada</dt>
              <dd className="font-medium text-emerald-300">{fmtRodada(data.config.miningBlockRewardUsdc)} USDT</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Intervalo</dt>
              <dd>{data.config.miningBlockIntervalMin} min</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Estimativa / dia</dt>
              <dd>{fmtUsdc(roiDaily)} USDT</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
          <p className="mb-2 font-semibold text-slate-300">Entradas e saídas</p>
          <dl className="space-y-1.5">
            <div className="flex justify-between"><dt className="text-slate-500">Depósitos</dt><dd>{fmtUsdc(data.capital.depositsUsdc)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Admin +</dt><dd className="text-purple-300">+{fmtUsdc(data.capital.adminCreditsUsdc)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Saques</dt><dd className="text-red-300">−{fmtUsdc(data.capital.withdrawalsUsdc)}</dd></div>
            <div className="flex justify-between border-t border-white/[0.06] pt-1.5">
              <dt className="text-slate-500">Share vs pago (Δ)</dt>
              <dd className={data.mining.shareVsPaidDriftUsdc > 0.02 ? 'text-red-300' : 'text-emerald-300'}>
                {fmtUsdc(data.mining.shareVsPaidDriftUsdc, 4)}
              </dd>
            </div>
          </dl>
        </div>

        {data.recentBlocks.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Últimos blocos</p>
            <div className="space-y-1">
              {data.recentBlocks.slice(0, 8).map((b) => (
                <div key={`${b.blockNumber}-${b.minedAt}`} className="flex items-center justify-between rounded-md bg-white/[0.03] px-2 py-1.5 text-[11px]">
                  <span className="text-slate-400">#{b.blockNumber}</span>
                  <span className="text-slate-500">{fmtPct(b.sharePct, 1)}</span>
                  <span className="font-medium text-emerald-300">{fmtUsdc(b.paidUsdc, 4)}</span>
                  <span className="text-slate-600">{formatAdminDate(b.minedAt).split(' ')[1] ?? ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          to={`/admin/users/${data.userId}`}
          className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 text-sm text-emerald-400 hover:bg-white/[0.06]"
        >
          <i className="bi bi-person-badge" aria-hidden />
          Abrir ficha completa
        </Link>
      </div>
    </div>
  );
}
