import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useWalletSummary, useWalletTransactions } from '../../hooks/useApi';
import { useEnsureTargetChain } from '../../hooks/useEnsureTargetChain';
import { WalletOverview } from './WalletOverview';
import { WalletDepositForm } from './WalletDepositForm';
import { WalletWithdrawForm } from './WalletWithdrawForm';
import { WalletHistoryTable } from './WalletHistoryTable';
import { WalletSwapForm } from './WalletSwapForm';
import { WalletMiningChart } from './WalletMiningChart';

type WalletTab = 'overview' | 'deposit' | 'withdraw' | 'swap' | 'history' | 'analytics';

const TABS: WalletTab[] = ['overview', 'deposit', 'swap', 'withdraw', 'history', 'analytics'];

export function WalletHub() {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const { onTargetChain } = useEnsureTargetChain();
  const { data: summary } = useWalletSummary();
  const [tab, setTab] = useState<WalletTab>(() => {
    if (typeof window === 'undefined') return 'deposit';
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    return fromUrl && TABS.includes(fromUrl as WalletTab) ? (fromUrl as WalletTab) : 'deposit';
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === tab) return;
    params.set('tab', tab);
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [tab]);
  const [flow, setFlow] = useState<'all' | 'gmt' | 'in' | 'out'>('gmt');
  const { data: history, isLoading: historyLoading } = useWalletTransactions({
    type: tab === 'history' && flow === 'all' ? 'all' : 'game',
    flow: tab === 'history' ? flow : 'all',
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`pixel-btn pixel-btn-md w-full ${tab === key ? 'pixel-btn-blue' : ''}`}
            style={
              tab === key
                ? undefined
                : { background: 'var(--bg-light)', color: 'var(--text-secondary)' }
            }
          >
            {t(`wallet.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div className="pixel-card pixel-card-fluid p-4 sm:p-6 lg:p-8 w-full min-w-0" style={{ borderColor: 'var(--purple)' }}>
        {!onTargetChain && (
          <p
            className="retro-text mb-4 rounded border px-3 py-2 text-xs"
            style={{ borderColor: 'var(--orange)', color: 'var(--orange)' }}
          >
            {t('wallet.wrongNetworkHint')}
          </p>
        )}
        {tab === 'overview' && <WalletOverview onGoDeposit={() => setTab('deposit')} />}
        {tab === 'deposit' && <WalletDepositForm linkedWallet={user?.wallet} />}
        {tab === 'swap' && <WalletSwapForm />}
        {tab === 'withdraw' && (
          <WalletWithdrawForm
            linkedWallet={user?.wallet}
            vaultBalance={summary?.usdtBalance ?? 0}
            minWithdraw={summary?.minWithdrawUsdc ?? 1}
            withdrawFeePct={summary?.withdrawFeePct ?? 0.05}
            withdrawalsPaused={summary?.withdrawalsPaused ?? false}
          />
        )}
        {tab === 'analytics' && <WalletMiningChart />}
        {tab === 'history' && (
          <WalletHistoryTable
            items={history?.items ?? []}
            ledgerStartedAt={history?.ledgerStartedAt ?? null}
            isLoading={historyLoading}
            gmtReceived={summary?.gmtReceived ?? 0}
            gmtSpent={summary?.gmtSpent ?? 0}
            filter={flow}
            onFilter={setFlow}
          />
        )}
      </div>
    </div>
  );
}
