import { useEffect, useState } from 'react';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminButton, AdminPageHeader } from '../../../components/admin/AdminTable';

interface MultiIpAlert {
  userId: string;
  email: string | null;
  username: string | null;
  uniqueIps: number;
  lastIp: string;
  lastSeenAt: string;
  ips: string[];
}

interface SharedIp {
  ip: string;
  uniqueUsers: number;
  users: Array<{ userId: string; email: string | null; username: string | null }>;
}

function IpBadge({ count, label }: { count: number; label: string }) {
  const danger = count >= 5;
  const warn = count >= 3;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
      danger
        ? 'border-red-500/40 bg-red-500/15 text-red-300'
        : warn
        ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
        : 'border-white/10 bg-white/[0.05] text-slate-400'
    }`}>
      {count} {label}
    </span>
  );
}

function IpChip({ ip }: { ip: string }) {
  const isV6 = ip.includes(':');
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] break-all ${
      isV6
        ? 'border-purple-500/20 bg-purple-500/[0.06] text-purple-300'
        : 'border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-300'
    }`}>
      {ip}
    </span>
  );
}

function MultiIpCard({ a }: { a: MultiIpAlert }) {
  const [open, setOpen] = useState(false);
  const danger = a.uniqueIps >= 5;
  const warn = a.uniqueIps >= 3;
  const ts = new Date(a.lastSeenAt).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={`border-b border-white/[0.04] last:border-0 transition-colors ${danger ? 'bg-red-500/[0.03]' : ''}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          danger
            ? 'border-red-500/30 bg-red-500/10'
            : warn
            ? 'border-amber-400/30 bg-amber-400/10'
            : 'border-white/10 bg-white/[0.03]'
        }`}>
          <i className={`bi bi-person-fill text-xs ${danger ? 'text-red-400' : warn ? 'text-amber-400' : 'text-slate-500'}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-100">
              {a.username ?? a.email?.split('@')[0] ?? a.userId.slice(0, 8)}
            </span>
            <IpBadge count={a.uniqueIps} label="IPs" />
          </div>
          <p className="mt-0.5 text-xs text-slate-500 truncate">{a.email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
            <span>Último:</span>
            <IpChip ip={a.lastIp} />
            <span>·</span>
            <span>{ts}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
        >
          <i className={`bi ${open ? 'bi-chevron-up' : 'bi-geo-alt'} text-[9px]`} />
          {open ? 'Fechar' : `Ver IPs (${a.ips.length})`}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/[0.04] bg-[#060d14] px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {a.ips.map((ip) => <IpChip key={ip} ip={ip} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function SharedIpCard({ c }: { c: SharedIp }) {
  const danger = c.uniqueUsers >= 3;
  const isV6 = c.ip.includes(':');

  return (
    <div className={`border-b border-white/[0.04] last:border-0 px-4 py-3 ${danger ? 'bg-red-500/[0.03]' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          danger ? 'border-red-500/30 bg-red-500/10' : 'border-amber-400/30 bg-amber-400/10'
        }`}>
          <i className={`bi bi-globe text-xs ${danger ? 'text-red-400' : 'text-amber-400'}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`font-mono text-xs font-semibold break-all ${isV6 ? 'text-purple-300' : 'text-cyan-300'}`}>
              {c.ip}
            </span>
            <IpBadge count={c.uniqueUsers} label="contas" />
          </div>
          <div className="space-y-1">
            {c.users.map((u) => (
              <div key={u.userId} className="flex items-center gap-1.5 text-xs">
                <i className="bi bi-person text-[10px] text-slate-600" />
                <span className="text-slate-300 font-medium">
                  {u.username ?? u.email?.split('@')[0] ?? u.userId.slice(0, 8)}
                </span>
                {u.email && <span className="text-slate-600 truncate">({u.email})</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminSecurityPage() {
  const [alerts, setAlerts] = useState<MultiIpAlert[]>([]);
  const [clusters, setClusters] = useState<SharedIp[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'multi' | 'shared'>('multi');

  async function load() {
    setLoading(true);
    try {
      const [{ data: a }, { data: c }] = await Promise.all([
        adminClient.get<{ alerts: MultiIpAlert[] }>('/security/multi-ip-users'),
        adminClient.get<{ clusters: SharedIp[] }>('/security/shared-ips'),
      ]);
      setAlerts(a.alerts);
      setClusters(c.clusters);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const highRiskAlerts = alerts.filter((a) => a.uniqueIps >= 5).length;
  const highRiskClusters = clusters.filter((c) => c.uniqueUsers >= 3).length;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Segurança"
        subtitle="Alertas de IP — múltiplos IPs por conta ou múltiplas contas por IP"
        actions={
          <AdminButton size="sm" onClick={() => void load()} disabled={loading}>
            {loading
              ? <><i className="bi bi-arrow-repeat animate-spin text-xs" /> Atualizando…</>
              : <><i className="bi bi-arrow-repeat text-xs" /> Atualizar</>
            }
          </AdminButton>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="admin-card p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Multi-IP</p>
          <p className="text-2xl font-bold text-slate-100">{alerts.length}</p>
          <p className="text-[10px] text-slate-600">contas com 2+ IPs</p>
        </div>
        <div className="admin-card p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-red-400/70 font-semibold">Alto Risco</p>
          <p className="text-2xl font-bold text-red-400">{highRiskAlerts}</p>
          <p className="text-[10px] text-slate-600">5+ IPs diferentes</p>
        </div>
        <div className="admin-card p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">IPs Compartilhados</p>
          <p className="text-2xl font-bold text-slate-100">{clusters.length}</p>
          <p className="text-[10px] text-slate-600">IPs com 2+ contas</p>
        </div>
        <div className="admin-card p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-amber-400/70 font-semibold">Clusters Críticos</p>
          <p className="text-2xl font-bold text-amber-400">{highRiskClusters}</p>
          <p className="text-[10px] text-slate-600">3+ contas no IP</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl border border-white/[0.06] bg-white/[0.02] w-fit">
        {([
          { key: 'multi', label: `Múltiplos IPs`, count: alerts.length, icon: 'bi-person-exclamation' },
          { key: 'shared', label: `IPs Compartilhados`, count: clusters.length, icon: 'bi-globe' },
        ] as const).map(({ key, label, count, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
              tab === key
                ? 'bg-white/[0.08] text-slate-100'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <i className={`bi ${icon}`} />
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
              tab === key ? 'bg-white/10 text-slate-300' : 'bg-white/[0.04] text-slate-600'
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="admin-card flex items-center justify-center py-16 gap-2 text-slate-500">
          <i className="bi bi-arrow-repeat animate-spin" />
          <span className="text-sm">Carregando dados…</span>
        </div>
      ) : tab === 'multi' ? (
        <div className="admin-card overflow-hidden p-0">
          <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {alerts.length} usuários com múltiplos IPs públicos
            </p>
            {highRiskAlerts > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-red-400">
                <i className="bi bi-exclamation-triangle-fill text-[9px]" />
                {highRiskAlerts} alto risco
              </span>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <i className="bi bi-shield-check text-3xl mb-3 text-emerald-600" />
              <p className="text-sm">Nenhum alerta de múltiplos IPs.</p>
            </div>
          ) : (
            alerts.map((a) => <MultiIpCard key={a.userId} a={a} />)
          )}
        </div>
      ) : (
        <div className="admin-card overflow-hidden p-0">
          <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {clusters.length} IPs com múltiplas contas
            </p>
            {highRiskClusters > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400">
                <i className="bi bi-exclamation-triangle-fill text-[9px]" />
                {highRiskClusters} clusters críticos
              </span>
            )}
          </div>
          {clusters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <i className="bi bi-shield-check text-3xl mb-3 text-emerald-600" />
              <p className="text-sm">Nenhum IP compartilhado detectado.</p>
            </div>
          ) : (
            clusters.map((c) => <SharedIpCard key={c.ip} c={c} />)
          )}
        </div>
      )}
    </div>
  );
}
