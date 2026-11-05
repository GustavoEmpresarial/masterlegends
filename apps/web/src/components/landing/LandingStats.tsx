import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { usePublicStats } from '../../hooks/usePublicStats';

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSiteAge(launchedAt: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diffMs = Math.max(0, Date.now() - new Date(launchedAt).getTime());
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return t('landing:stats.uptimeValue', { days, hours });
  }

  return t('landing:stats.uptimeHours', { hours: Math.max(hours, 1) });
}

export function LandingStats() {
  const { t } = useTranslation('landing');
  const { data, isLoading } = usePublicStats();

  const items = [
    {
      key: 'users',
      icon: 'bi-people-fill',
      color: 'var(--green)',
      value: data ? data.registeredUsers.toLocaleString() : '…',
    },
    {
      key: 'deposited',
      icon: 'bi-cash-stack',
      color: 'var(--gold)',
      value: data ? formatUsd(data.totalDepositedUsd) : '…',
    },
    {
      key: 'nfts',
      icon: 'bi-shield-fill',
      color: 'var(--blue)',
      value: data ? data.nftsMinted.toLocaleString() : '…',
    },
    {
      key: 'uptime',
      icon: 'bi-stopwatch-fill',
      color: 'var(--purple)',
      value: data ? formatSiteAge(data.launchedAt, t) : '…',
    },
  ] as const;

  return (
    <motion.div
      className="mt-12 md:mt-14 lg:mt-16"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
    >
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
        {items.map((item, index) => (
          <motion.div
            key={item.key}
            className="pixel-box p-4 text-center md:p-5"
            style={{ borderColor: item.color, opacity: isLoading ? 0.7 : 1 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: isLoading ? 0.7 : 1, y: 0 }}
            transition={{ delay: 0.5 + index * 0.06 }}
          >
            <div className="mb-2 text-3xl md:text-4xl"><i className={`bi ${item.icon}`} aria-hidden /></div>
            <div className="retro-text mb-1 text-2xl font-bold md:text-3xl" style={{ color: item.color }}>
              {item.value}
            </div>
            <div className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
              {t(`stats.${item.key}`)}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
