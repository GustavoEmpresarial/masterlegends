import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { PublicWalletActivityItemDTO } from '@mll/shared';
import { getExplorerTxUrl } from '../../lib/web3/chains';
import { usePublicWalletActivity } from '../../hooks/usePublicWalletActivity';

function formatUsdc(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatRelativeTime(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t('walletActivity.justNow');
  if (minutes < 60) return t('walletActivity.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('walletActivity.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('walletActivity.daysAgo', { count: days });
}

interface ActivityCardProps {
  title: string;
  emptyLabel: string;
  errorLabel?: string;
  items: PublicWalletActivityItemDTO[];
  borderColor: string;
  amountColor: string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function ActivityCard({
  title,
  emptyLabel,
  errorLabel,
  items,
  borderColor,
  amountColor,
  isLoading,
  isError,
  onRetry,
}: ActivityCardProps) {
  const { t } = useTranslation('landing');

  return (
    <motion.div
      className="pixel-box p-4 md:p-5"
      style={{ borderColor, opacity: isLoading ? 0.7 : 1 }}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <h3 className="pixel-text mb-4 text-lg md:text-xl" style={{ color: borderColor }}>
        {title}
      </h3>

      {isLoading ? (
        <p className="retro-text text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('walletActivity.loading')}
        </p>
      ) : isError ? (
        <div className="py-6 text-center space-y-3">
          <p className="retro-text text-sm" style={{ color: 'var(--orange)' }}>
            {errorLabel ?? t('walletActivity.loadError')}
          </p>
          {onRetry && (
            <button type="button" className="pixel-btn pixel-btn-sm pixel-btn-blue" onClick={onRetry}>
              {t('walletActivity.retry')}
            </button>
          )}
        </div>
      ) : items.length === 0 ? (
        <p className="retro-text text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          {emptyLabel}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0"
              style={{ borderColor: 'var(--bg-lighter)' }}
            >
              <div className="min-w-0 flex-1">
                <div className="retro-text text-sm font-bold" style={{ color: amountColor }}>
                  {formatUsdc(item.amountUsdc)} USDC
                </div>
                <div className="retro-text truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                  {item.walletMasked ?? t('walletActivity.anonymous')}
                  {' · '}
                  {formatRelativeTime(item.createdAt, t)}
                </div>
              </div>
              <a
                href={getExplorerTxUrl(item.txHash)}
                target="_blank"
                rel="noreferrer"
                className="ui-label-sm shrink-0 underline underline-offset-2 hover:opacity-80"
                style={{ color: 'var(--blue)' }}
                title={item.txHash}
              >
                {item.txHash.slice(0, 8)}…
              </a>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

export function LandingWalletActivity() {
  const { t } = useTranslation('landing');
  const { data, isLoading, isError, refetch } = usePublicWalletActivity();

  return (
    <section className="px-4 pb-8 md:pb-12" style={{ background: 'var(--bg-dark)' }}>
      <div className="mx-auto max-w-xl space-y-5">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="pixel-text mb-2 text-xl md:text-2xl" style={{ color: 'var(--gold)' }}>
            {t('walletActivity.title')}
          </h2>
          <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('walletActivity.subtitle')}
          </p>
        </motion.div>

        <ActivityCard
          title={t('walletActivity.depositsTitle')}
          emptyLabel={t('walletActivity.depositsEmpty')}
          items={data?.deposits ?? []}
          borderColor="var(--green)"
          amountColor="var(--green)"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
        />

        <ActivityCard
          title={t('walletActivity.withdrawalsTitle')}
          emptyLabel={t('walletActivity.withdrawalsEmpty')}
          items={data?.withdrawals ?? []}
          borderColor="var(--purple)"
          amountColor="var(--red)"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
        />
      </div>
    </section>
  );
}
