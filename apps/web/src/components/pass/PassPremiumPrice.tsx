import type { PassPremiumPricingDTO } from '@mll/shared';
import { useTranslation } from 'react-i18next';

export function PassPremiumPrice({ pricing }: { pricing: PassPremiumPricingDTO }) {
  const { t, i18n } = useTranslation('pass');
  const money = (value: number) => value.toLocaleString(i18n.resolvedLanguage || i18n.language, { maximumFractionDigits: 8 });
  return (
    <section className="mb-5 space-y-3 rounded-lg border border-white/15 bg-black/15 p-3 sm:p-4" aria-label={t('pricing.title')}>
      <h2 className="text-label font-bold" style={{ color: 'var(--gold)' }}>
        <i className="bi bi-ticket-perforated mr-2" aria-hidden />{t('pricing.title')}
      </h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('pricing.base')}</dt>
          <dd className="retro-text text-lg mt-1">{money(pricing.basePriceGmt)} GMT</dd>
        </div>
        <div>
          <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('pricing.discount')}</dt>
          <dd className="retro-text text-lg mt-1" style={{ color: 'var(--green)' }}>−{money(pricing.discountGmt)} GMT</dd>
        </div>
        <div>
          <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('pricing.payNow')}</dt>
          <dd className="retro-text text-2xl font-bold mt-1" style={{ color: 'var(--gold)' }}>{money(pricing.priceGmt)} GMT</dd>
        </div>
      </dl>
      <p className="text-sm">{t('pricing.levels', { completed: pricing.completedLevels, total: pricing.totalLevels, percent: money(pricing.completionPct) })}</p>
      <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label={t('pricing.milestones')}>
        {pricing.milestones.map(milestone => (
          <li key={milestone.completionPct} className="rounded border p-2 text-sm" style={{ borderColor: milestone.reached ? 'var(--green)' : 'var(--bg-lighter)', background: milestone.reached ? 'rgba(98,200,98,0.08)' : 'transparent' }}>
            <div className="font-bold" style={{ color: milestone.reached ? 'var(--green)' : 'var(--text-primary)' }}>
              <i className={`bi ${milestone.reached ? 'bi-check-circle-fill' : 'bi-lock'} mr-1`} aria-hidden />{milestone.completionPct}% · −{money(milestone.discountGmt)} GMT
            </div>
            <p className="mt-1 text-xs">{t('pricing.levelTarget', { count: milestone.requiredLevels })}</p>
          </li>
        ))}
      </ol>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('pricing.rewardHint')}</p>
    </section>
  );
}
