import { useEffect, useState } from 'react';
import type { PlatformConfigDTO } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminPageHeader } from '../../../components/admin/AdminTable';
import { adminPt } from '../../../lib/admin/i18n';

export function AdminWalletPage() {
  const [cfg, setCfg] = useState<PlatformConfigDTO | null>(null);
  const [minDeposit, setMinDeposit] = useState('');
  const [minWithdraw, setMinWithdraw] = useState('');
  const [withdrawFeePct, setWithdrawFeePct] = useState('');
  const [paused, setPaused] = useState(false);
  const [miningReward, setMiningReward] = useState('');
  const [miningInterval, setMiningInterval] = useState('');
  const [marketFeeBps, setMarketFeeBps] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const t = adminPt.walletConfig;

  useEffect(() => {
    void adminClient.get<PlatformConfigDTO>('/wallet-config').then((res) => {
      setCfg(res.data);
      setMinDeposit(String(res.data.minDepositUsdc));
      setMinWithdraw(String(res.data.minWithdrawUsdc));
      setWithdrawFeePct(String(res.data.withdrawFeePct ?? 0.05));
      setPaused(res.data.withdrawalsPaused);
      setMiningReward(String(res.data.miningBlockRewardUsdc));
      setMiningInterval(String(res.data.miningBlockIntervalMin));
      setMarketFeeBps(String(res.data.marketplaceFeeBps));
    });
  }, []);

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const { data } = await adminClient.patch<PlatformConfigDTO>('/wallet-config', {
        minDepositUsdc: Number(minDeposit),
        minWithdrawUsdc: Number(minWithdraw),
        withdrawFeePct: Number(withdrawFeePct),
        withdrawalsPaused: paused,
        miningBlockRewardUsdc: Number(miningReward),
        miningBlockIntervalMin: Number(miningInterval),
        marketplaceFeeBps: Number(marketFeeBps),
      });
      setCfg(data);
      setMessage(adminPt.saved);
    } catch {
      setMessage(adminPt.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminPageHeader title={t.title} subtitle={t.subtitle} />
      {cfg && (
        <div className="max-w-md space-y-4">
          <p className="text-sm text-slate-400">
            {t.vault}: <span className="text-slate-200">{cfg.vaultAddress ?? adminPt.notSet}</span>
          </p>
          <p className="text-sm text-slate-400">{t.chainId}: {cfg.chainId}</p>
          <label className="block text-sm">
            <span className="text-slate-400">{t.minDeposit}</span>
            <input
              type="number"
              step="0.01"
              value={minDeposit}
              onChange={(e) => setMinDeposit(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">{t.minWithdraw}</span>
            <input
              type="number"
              step="0.01"
              value={minWithdraw}
              onChange={(e) => setMinWithdraw(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">{t.withdrawFee}</span>
            <input
              type="number"
              step="0.001"
              min="0"
              max="1"
              value={withdrawFeePct}
              onChange={(e) => setWithdrawFeePct(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
            <span>{t.paused}</span>
          </label>

          <div className="border-t border-slate-700 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Patrocínios da liga</h3>
            <label className="block text-sm">
              <span className="text-slate-400">Cota por rodada (USDT)</span>
              <input
                type="number"
                step="0.0001"
                value={miningReward}
                onChange={(e) => setMiningReward(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-400">Intervalo entre rodadas (minutos)</span>
              <input
                type="number"
                step="1"
                min="1"
                value={miningInterval}
                onChange={(e) => setMiningInterval(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
              />
            </label>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Marketplace</h3>
            <label className="block text-sm">
              <span className="text-slate-400">Taxa do mercado (basis points · 1000 = 10%)</span>
              <input
                type="number"
                step="1"
                min="0"
                max="10000"
                value={marketFeeBps}
                onChange={(e) => setMarketFeeBps(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Tesoureiro e Treinador são configurados em Conteúdo do Jogo → Escritório.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded bg-emerald-800 px-4 py-2 text-sm disabled:opacity-50"
          >
            {saving ? adminPt.saving : adminPt.save}
          </button>
          {message && <p className="text-sm text-emerald-400">{message}</p>}
        </div>
      )}
    </>
  );
}
