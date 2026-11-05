import { useTranslation } from 'react-i18next';

export function StadiumIncomeNotice({
  online,
  compact = false,
}: {
  online: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation('club');
  const accent = online ? '#7ee07e' : '#e8c56a';

  return (
    <div
      className={
        compact
          ? 'rounded-sm border bg-black/80 px-3 py-2 text-left backdrop-blur-sm'
          : 'pixel-card px-4 py-4 sm:px-5'
      }
      style={{ borderColor: accent, borderWidth: compact ? 1 : 3 }}
    >
      <p
        className={compact ? 'pixel-text text-xs sm:text-sm' : 'pixel-text text-base sm:text-lg'}
        style={{ color: accent }}
      >
        {online ? t('stadium.incomeNowFull') : t('stadium.incomeNowReduced')}
      </p>
      <ul className={`mt-2 space-y-1 ${compact ? 'text-[11px] sm:text-xs' : 'text-sm sm:text-base'}`}>
        <li className="retro-text" style={{ color: '#7ee07e' }}>
          {t('stadium.incomeRuleOpen')}
        </li>
        <li className="retro-text" style={{ color: '#e8c56a' }}>
          {t('stadium.incomeRuleClosed')}
        </li>
      </ul>
    </div>
  );
}
