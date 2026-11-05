import type { ScoutRarityRuleDTO } from '@mll/shared';
import { useTranslation } from 'react-i18next';
import type { ScoutRevealCardConfig } from './ScoutRevealCard';

interface ScoutMintConfirmProps {
  quantity: number;
  totalLabel: string;
  lateralPct: number;
  rarities: ScoutRarityRuleDTO[];
  rarityConfig: Record<string, ScoutRevealCardConfig>;
  formatChance: (pct: number | undefined) => string;
  formatRange: (min: number, max: number) => string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ScoutMintConfirm({
  quantity,
  totalLabel,
  lateralPct,
  rarities,
  rarityConfig,
  formatChance,
  formatRange,
  onCancel,
  onConfirm,
}: ScoutMintConfirmProps) {
  const { t } = useTranslation('scout');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scout-mint-confirm-title"
    >
      <div className="pixel-card w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4" style={{ borderColor: 'var(--gold)' }}>
        <h2 id="scout-mint-confirm-title" className="pixel-text text-lg text-center" style={{ color: 'var(--gold)' }}>
          {t('confirm.title')}
        </h2>

        <div className="flex items-center justify-between px-4 py-3 pixel-box" style={{ borderColor: 'var(--gold)' }}>
          <span className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('mint', { count: quantity })}
          </span>
          <span className="pixel-text text-xl" style={{ color: 'var(--gold)' }}>
            {totalLabel} GMT
          </span>
        </div>

        <ul className="space-y-2">
          {[...rarities].reverse().map((rule) => {
            const config = rarityConfig[rule.id];
            const color = config?.color ?? 'var(--rarity-common)';
            return (
              <li key={rule.id} className="flex items-center justify-between px-3 py-2" style={{ border: `1px solid ${color}40` }}>
                <span className="retro-text text-sm" style={{ color }}>{config?.label ?? rule.id}</span>
                <span className="retro-text text-sm tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {formatChance(rule.chancePct)} · {formatRange(rule.overwallMin, rule.overwallMax)}
                </span>
              </li>
            );
          })}
        </ul>

        <ul className="space-y-2 retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
          <li>{t('rules.attributes')}</li>
          <li>{t('rules.lateral', { pct: lateralPct })}</li>
          <li>{t('rules.payment')}</li>
          <li>{t('rules.inventory')}</li>
        </ul>

        <div className="flex gap-3">
          <button type="button" className="pixel-btn pixel-btn-md flex-1" onClick={onCancel}>
            {t('confirm.cancel')}
          </button>
          <button type="button" className="pixel-btn pixel-btn-gold pixel-btn-md flex-1" onClick={onConfirm}>
            {t('confirm.pay')}
          </button>
        </div>
      </div>
    </div>
  );
}
