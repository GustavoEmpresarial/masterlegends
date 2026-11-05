import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminUserRoiDTO } from '@mll/shared';
import { adminClient } from '../../lib/api/adminClient';

function fmt(n: number, d = 2) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

interface UserRoiSectionProps {
  userId: string;
}

export function UserRoiSection({ userId }: UserRoiSectionProps) {
  const [data, setData] = useState<AdminUserRoiDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const { data: roi } = await adminClient.get<AdminUserRoiDTO>(`/users/${userId}/roi`);
        if (!cancelled) setData(roi);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <p className="text-sm text-slate-500">Calculando ROI…</p>;
  }
  if (!data) return null;

  const alertCls =
    data.roi.alertLevel === 'critical'
      ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : data.roi.alertLevel === 'warning'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';

  return (
    <div className="space-y-3">
      <div className={`rounded-lg border px-3 py-2 text-sm ${alertCls}`}>
        {data.roi.alerts[0] ??
          `Capital ${fmt(data.capital.netCapitalIn)} USDC · Patrocínios ${fmt(data.mining.totalPaidUsdc)} USDC · ROI ${data.roi.percentOnCapital != null ? `${fmt(data.roi.percentOnCapital)}%` : '—'}`}
      </div>
      <div className="grid gap-2 sm:grid-cols-3 text-xs">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-slate-500">Depósitos + admin</p>
          <p className="font-semibold text-slate-200">
            {fmt(data.capital.depositsUsdc + data.capital.adminCreditsUsdc)} USDC
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-slate-500">Drift patrocínios</p>
          <p className={`font-semibold ${data.mining.shareVsPaidDriftUsdc > 0.02 ? 'text-red-300' : 'text-emerald-300'}`}>
            {fmt(data.mining.shareVsPaidDriftUsdc, 4)} USDC
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-slate-500">24h / estimado dia</p>
          <p className="font-semibold text-slate-200">
            {fmt(data.mining.last24hUsdc)} / {fmt(data.mining.estimatedDailyUsdc)} USDC
          </p>
        </div>
      </div>
      <Link
        to={`/admin/roi?userId=${userId}`}
        className="inline-flex text-xs text-emerald-400 hover:text-emerald-300"
      >
        Ver auditoria completa →
      </Link>
    </div>
  );
}
