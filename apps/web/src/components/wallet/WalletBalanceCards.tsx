import { useTranslation } from 'react-i18next';
import type { WalletSummaryDTO } from '@mll/shared';
import { formatGmtAmount, formatStableAmount } from '../../lib/formatUsdc';

interface WalletBalanceCardsProps {
  summary: WalletSummaryDTO | undefined;
  vaultBalance?: number;
  nativeBalance?: number;
  nativeSymbol?: string;
  isLoading?: boolean;
}

export function WalletBalanceCards({
  summary,
  vaultBalance,
  nativeBalance = 0,
  nativeSymbol = 'POL',
  isLoading,
}: WalletBalanceCardsProps) {
  const { t } = useTranslation('common');

  const cards = [
    {
      label: t('wallet.balances.gmtAvailable', { defaultValue: 'GMT disponível' }),
      value: summary?.gmtBalance != null ? formatGmtAmount(summary.gmtBalance) : '—',
      sub: t('wallet.balances.gmtAvailableHint', { defaultValue: 'Pode ser usado' }),
      icon: 'bi-coin',
      color: 'var(--gold)',
    },
    {
      label: t('wallet.balances.gmtLocked', { defaultValue: 'GMT bloqueado' }),
      value: summary?.gmtLocked != null ? formatGmtAmount(summary.gmtLocked) : '—',
      sub: t('wallet.balances.gmtLockedHint', { defaultValue: 'Comprometido em uma operação' }),
      icon: 'bi-lock',
      color: 'var(--orange)',
    },
    {
      label: t('wallet.balances.usdcVault'),
      value: isLoading ? '...' : formatStableAmount(vaultBalance ?? summary?.usdcBalance ?? 0),
      sub: t('wallet.balances.usdcVaultHint'),
      icon: 'bi-cash-stack',
      color: 'var(--green)',
    },
    {
      label: t('wallet.balances.usdt', { defaultValue: 'USDT (sacável)' }),
      value: isLoading ? '...' : formatStableAmount(summary?.usdtBalance ?? 0),
      sub: t('wallet.balances.usdtHint', { defaultValue: 'Ganhos de mineração — saque em USDT' }),
      icon: 'bi-cash-coin',
      color: 'var(--green)',
    },
    {
      label: t('wallet.balances.gas'),
      value: isLoading ? '...' : nativeBalance.toFixed(4),
      sub: nativeSymbol,
      icon: 'bi-fuel-pump',
      color: 'var(--purple)',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="pixel-box-light p-5 lg:p-6"
          style={{ borderColor: card.color }}
        >
          <div className="mb-3 flex items-center gap-2">
            <i className={`bi ${card.icon} text-2xl`} aria-hidden />
            <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
              {card.label}
            </p>
          </div>
          <p className="pixel-text text-xl lg:text-2xl" style={{ color: card.color }}>
            {card.value}
          </p>
          {card.sub && (
            <p className="retro-text mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {card.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
