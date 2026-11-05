import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { InventoryPlayerDTO } from '@mll/shared';
import { useClub, useInventory, useMergeFuse, useMergeRules } from '../../../hooks/useApi';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import { translateError } from '../../../lib/apiError';
import { ScoutRevealCard, buildRarityConfig } from '../../../components/scout/ScoutRevealCard';
import { ScoutRevealCarousel } from '../../../components/scout/ScoutRevealCarousel';
import { PageContentShell } from '../../../components/content';
import { POSITION_EMOJI } from '../../../lib/stadiumConstants';

const INPUT_RARITIES = ['common', 'uncommon', 'rare', 'super-rare', 'epic'] as const;
const POSITION_SPRITES: Record<string, string> = POSITION_EMOJI;

export function MergerPage() {
  const { t } = useTranslation(['merger', 'scout', 'common', 'inventory']);
  const { data: club } = useClub();
  const { data: inventory, isLoading: inventoryLoading } = useInventory();
  const { data: rules, isLoading: rulesLoading } = useMergeRules();
  const fuse = useMergeFuse();

  const [inputRarity, setInputRarity] = useState<(typeof INPUT_RARITIES)[number]>('common');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState<InventoryPlayerDTO | null>(null);

  const rarityConfig = useMemo(() => buildRarityConfig((key) => t(`scout:${key}`)), [t]);
  const maxSelect = rules?.inputCount ?? 5;

  const eligible = useMemo(() => {
    const players = inventory?.players ?? [];
    return players.filter(
      (p) => p.kind === 'base' && !p.listed && !p.inLineup && p.rarity === inputRarity,
    );
  }, [inventory, inputRarity]);

  const tier = rules?.tiers.find((item) => item.inputRarity === inputRarity);
  const feeGmt = tier?.effectiveFeeUsdc ?? tier?.feeUsdc ?? 0;
  const originalFeeGmt = tier?.feeUsdc ?? 0;
  const discountPct = tier?.discountPct ?? 0;
  const hasDiscount = discountPct > 0;
  const gmtBalance = club?.gmtBalance ?? 0;
  const canAfford = gmtBalance >= feeGmt;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxSelect) return prev;
      return [...prev, id];
    });
  };

  const handleFuse = async () => {
    if (selected.length !== maxSelect || fuse.isPending || !canAfford) return;
    setError('');
    try {
      const result = await fuse.mutateAsync({ playerIds: selected, payWith: 'gmt' });
      setRevealed({
        id: result.newPlayer.id,
        rarity: result.newPlayer.rarity,
        overwall: result.newPlayer.overwall,
        position: result.newPlayer.position,
        listed: false,
        kind: 'base',
        name: result.newPlayer.name,
        imageUrl: result.newPlayer.imageUrl,
      });
      setSelected([]);
    } catch (err: unknown) {
      setError(translateError(err, 'UNKNOWN'));
    }
  };

  if (inventoryLoading || rulesLoading) {
    return (
      <div className="pixel-card text-center py-16">
        <p className="retro-text text-xl" style={{ color: 'var(--text-muted)' }}>
          {t('common:labels.status.loading')}
        </p>
      </div>
    );
  }

  return (
    <PageContentShell wide>
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          >
            <div className="pixel-card max-w-lg w-full text-center space-y-6" style={{ borderColor: 'var(--gold)' }}>
              <p className="pixel-text text-lg" style={{ color: 'var(--gold)' }}>
                <i className="bi bi-stars" aria-hidden /> {t('merger:success')}
              </p>
              <ScoutRevealCarousel
                players={[
                  {
                    ...revealed,
                    sprite: POSITION_SPRITES[revealed.position] ?? 'bi-shield-fill',
                  },
                ]}
                rarityConfig={rarityConfig}
              />
              <button
                type="button"
                className="pixel-btn pixel-btn-gold pixel-btn-md"
                onClick={() => setRevealed(null)}
              >
                {t('merger:revealDismiss')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
      >
        <div className="min-w-0 flex-1">
          <h1 className="pixel-text text-2xl sm:text-3xl md:text-4xl" style={{ color: 'var(--purple)' }}>
            <i className="bi bi-fire" aria-hidden /> {t('merger:title')}
          </h1>
          <p className="retro-text text-base sm:text-lg mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('merger:subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <p className="retro-text text-lg sm:text-xl" style={{ color: 'var(--blue)' }}>
            {t('merger:selected', { count: selected.length, max: maxSelect })}
          </p>
          <button
            type="button"
            className="pixel-btn pixel-btn-purple pixel-btn-md"
            disabled={selected.length !== maxSelect || fuse.isPending || !canAfford}
            onClick={() => void handleFuse()}
          >
            {fuse.isPending ? t('merger:fusing') : <><i className="bi bi-fire" aria-hidden /> {t('merger:fuse')}</>}
          </button>
        </div>
      </motion.div>

      <div className="pixel-card space-y-3 w-full" style={{ borderColor: 'var(--blue)' }}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>{t('merger:feeTableTitle')}</p>
          {(rules?.tiers ?? []).some((tierRow) => tierRow.discountPct > 0) && (
            <p className="retro-text text-sm sm:text-base font-bold" style={{ color: 'var(--gold)' }}>
              <i className="bi bi-fire" aria-hidden /> {Math.round((rules!.tiers[0].discountPct) * 100)}% DE DESCONTO EM TODAS AS FUSÕES!
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {(rules?.tiers ?? []).map((item) => (
            <div
              key={item.inputRarity}
              className="pixel-box-light p-2.5 sm:p-3 min-w-0"
              style={{ borderColor: 'var(--bg-lighter)' }}
            >
              <p className="retro-text text-sm sm:text-base truncate" style={{ color: 'var(--text-secondary)' }}>
                {t(`scout:rarities.${item.inputRarity}`)} → {t(`scout:rarities.${item.outputRarity}`)}
              </p>
              <p className="retro-text text-base sm:text-lg mt-1 flex flex-wrap items-baseline gap-x-2">
                {item.discountPct > 0 ? (
                  <>
                    <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                      {item.feeUsdc} GMT
                    </span>
                    <span style={{ color: 'var(--gold)' }}>{item.effectiveFeeUsdc} GMT</span>
                  </>
                ) : (
                  <span style={{ color: 'var(--text-primary)' }}>{item.feeUsdc} GMT</span>
                )}
              </p>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>{t('merger:rulesTitle')}</p>
          <p className="retro-text text-base sm:text-lg">{t('merger:rulesCount')}</p>
          <p className="retro-text text-base sm:text-lg">{t('merger:rulesConsume')}</p>
          <p className="retro-text text-base sm:text-lg">{t('merger:rulesOnce')}</p>
          <p className="retro-text text-base sm:text-lg">{t('merger:rulesLineup')}</p>
          <p className="retro-text text-base sm:text-lg">
            {t('merger:rulesLegendary', { value: (rules?.legendaryValueGmt ?? 3125).toLocaleString('pt-BR') })}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className="pixel-card flex-1 min-w-0 space-y-2">
          <span className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
            {t('merger:inputRarity')}
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
            {INPUT_RARITIES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setInputRarity(key);
                  setSelected([]);
                }}
                className={`pixel-btn pixel-btn-sm shrink-0 ${inputRarity === key ? 'pixel-btn-gold' : ''}`}
              >
                {t(`scout:rarities.${key}`)}
              </button>
            ))}
          </div>
        </div>

        {tier && (
          <div
            className="pixel-box p-3 sm:p-4 flex-1 min-w-0 flex flex-col justify-center gap-1"
            style={{ borderColor: 'var(--gold)' }}
          >
            <p className="retro-text text-lg sm:text-xl font-bold">
              {t('merger:preview', {
                count: maxSelect,
                input: t(`scout:rarities.${tier.inputRarity}`),
                output: t(`scout:rarities.${tier.outputRarity}`),
              })}
            </p>
            <p className="retro-text text-base" style={{ color: 'var(--text-muted)' }}>
              {t('merger:overwallRange', {
                min: tier.overwallRange[0].toLocaleString(),
                max: tier.overwallRange[1].toLocaleString(),
              })}
            </p>
            {hasDiscount && (
              <p className="retro-text text-sm" style={{ color: 'var(--gold)' }}>
                <i className="bi bi-fire" aria-hidden /> {Math.round(discountPct * 100)}% DE DESCONTO ATIVO!
              </p>
            )}
            <p
              className="retro-text text-lg sm:text-xl mt-1 flex flex-wrap items-baseline gap-x-2"
              style={{ color: canAfford ? 'var(--green)' : 'var(--red)' }}
            >
              {hasDiscount ? (
                <>
                  <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                    {t('merger:fee', { fee: originalFeeGmt })}
                  </span>
                  <span>{t('merger:fee', { fee: feeGmt })}</span>
                </>
              ) : (
                t('merger:fee', { fee: feeGmt })
              )}
            </p>
            <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('merger:balanceGmt', { balance: gmtBalance.toLocaleString() })} · {t('merger:payWith')}
            </p>
          </div>
        )}
      </div>

      {!canAfford && tier && (
        <div className="pixel-box-light p-3 border-red">
          <p className="retro-text text-red text-center text-base sm:text-lg">
            {t('merger:insufficientBalance', { fee: feeGmt })}
          </p>
        </div>
      )}

      {error && (
        <div className="pixel-box-light p-3 border-red">
          <p className="retro-text text-red text-center">{error}</p>
        </div>
      )}

      {eligible.length === 0 ? (
        <div className="pixel-card text-center py-12">
          <p className="retro-text text-xl mb-4" style={{ color: 'var(--text-muted)' }}>
            {t('merger:empty')}
          </p>
          <Link to="/scout" className="pixel-btn pixel-btn-gold pixel-btn-md">
            <i className="bi bi-search" aria-hidden /> {t('merger:goScout')}
          </Link>
        </div>
      ) : (
        <div className="merger-player-grid w-full">
          {eligible.map((player, index) => {
            const isSelected = selected.includes(player.id);
            const config = rarityConfig[player.rarity] ?? rarityConfig.common;
            const label = player.name?.trim() || t(`inventory:kind.${player.kind}`);
            return (
              <motion.button
                key={player.id}
                type="button"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(index * 0.02, 0.3) }}
                onClick={() => toggleSelect(player.id)}
                className={`relative block w-full min-w-0 text-left rounded-none transition ring-2 ${
                  isSelected ? 'ring-[var(--gold)]' : 'ring-transparent'
                }`}
              >
                {isSelected && (
                  <span
                    className="absolute top-2 left-2 pixel-badge text-xs z-10"
                    style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
                  >
                    <i className="bi bi-check-lg" aria-hidden />
                  </span>
                )}
                <ScoutRevealCard
                  player={{
                    id: player.id,
                    rarity: player.rarity,
                    overwall: player.overwall,
                    position: player.position,
                    name: label,
                    imageUrl: player.imageUrl ? resolveUploadUrl(player.imageUrl) : undefined,
                    sprite: POSITION_SPRITES[player.position] ?? 'bi-shield-fill',
                    age: player.age,
                    costBasisUsdc: player.costBasisUsdc,
                  }}
                  config={config}
                  size="grid"
                  index={index}
                  animate={false}
                  className="w-full max-w-none"
                />
              </motion.button>
            );
          })}
        </div>
      )}
    </PageContentShell>
  );
}
