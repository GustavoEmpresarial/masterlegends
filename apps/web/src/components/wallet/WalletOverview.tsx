import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useWalletSummary } from '../../hooks/useApi';
import { useNativeBalance } from '../../hooks/useNativeBalance';
import { getTargetChainId } from '../../lib/web3/chains';
import { WalletBalanceCards } from './WalletBalanceCards';
import { WalletPanel } from './WalletPanel';

interface WalletOverviewProps {
  onGoDeposit?: () => void;
}

export function WalletOverview({ onGoDeposit }: WalletOverviewProps) {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const { data: summary, isLoading } = useWalletSummary();
  const native = useNativeBalance(user?.wallet);

  return (
    <div className="space-y-6">
      <div
        className="pixel-box-light px-4 py-2 text-center"
        style={{ borderColor: 'var(--blue)' }}
      >
        <p className="retro-text text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('wallet.networkBanner', { chainId: getTargetChainId() })}
        </p>
      </div>

      <WalletBalanceCards
        summary={summary}
        vaultBalance={summary?.usdcBalance ?? 0}
        nativeBalance={native.balance}
        nativeSymbol={native.symbol}
        isLoading={isLoading}
      />

      {onGoDeposit && (
        <button
          type="button"
          onClick={onGoDeposit}
          className="pixel-btn pixel-btn-green pixel-btn-md w-full"
        >
          {t('wallet.deposit.goToDeposit')}
        </button>
      )}

      <WalletPanel compact />
    </div>
  );
}
