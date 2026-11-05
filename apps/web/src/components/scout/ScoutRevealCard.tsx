import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { PLAYER_ATTRIBUTE_KEYS, type ScoutPlayerDTO } from '@mll/shared';
import { PlayerAgeBadge } from '../players/PlayerAgeBadge';
import { rarityColor, type ScoutRarity } from './scoutMintConstants';

export interface ScoutRevealCardConfig {
  color: string;
  label: string;
  glow?: string;
}

interface ScoutRevealCardProps {
  player: ScoutPlayerDTO & { sprite?: string };
  config: ScoutRevealCardConfig;
  size?: 'hero' | 'compact' | 'grid';
  index?: number;
  animate?: boolean;
  className?: string;
}

const RARITY_GLOW: Record<string, string> = {
  common: '0 0 20px rgba(148, 163, 184, 0.25)',
  rare: '0 0 28px rgba(59, 130, 246, 0.45)',
  'super-rare': '0 0 32px rgba(168, 85, 247, 0.5)',
  epic: '0 0 40px rgba(245, 158, 11, 0.55)',
  legendary: '0 0 48px rgba(234, 179, 8, 0.65), 0 0 80px rgba(234, 179, 8, 0.25)',
};

export function ScoutRevealCard({
  player,
  config,
  size = 'compact',
  index = 0,
  animate = true,
  className = '',
}: ScoutRevealCardProps) {
  const { t } = useTranslation('scout');
  const isHero = size === 'hero';
  const isGrid = size === 'grid';
  const rarity = player.rarity as ScoutRarity;
  const glow = RARITY_GLOW[rarity] ?? RARITY_GLOW.common;
  const isHighRarity = rarity === 'epic' || rarity === 'legendary';
  const displayName = player.name?.trim() || player.position;

  const Wrapper = animate ? motion.div : 'div';
  const wrapperProps = animate
    ? {
        initial: { opacity: 0, scale: 0.6, rotateY: -90 },
        animate: { opacity: 1, scale: 1, rotateY: 0 },
        transition: {
          delay: index * 0.15,
          duration: 0.65,
          type: 'spring' as const,
          stiffness: 120,
          damping: 14,
        },
      }
    : {};

  const sizeClass = isHero
    ? 'scout-reveal-card--hero'
    : isGrid
      ? 'scout-reveal-card--grid'
      : '';

  return (
    <Wrapper
      {...wrapperProps}
      className={`scout-reveal-card ${sizeClass} ${isHighRarity ? 'scout-reveal-card--premium' : ''} ${className}`.trim()}
      style={
        {
          '--rarity-color': config.color,
          '--rarity-glow': glow,
          borderColor: config.color,
        } as CSSProperties
      }
    >
      <div className="scout-reveal-card__shine" aria-hidden />
      {isHighRarity && <div className="scout-reveal-card__aurora" aria-hidden />}

      <div className="scout-reveal-card__top">
        <span className="scout-reveal-card__rarity">{config.label}</span>
        <span className="scout-reveal-card__name" title={displayName}>
          {displayName}
        </span>
      </div>

      <div className="scout-reveal-card__art">
        <div className="scout-reveal-card__art-frame">
          {player.imageUrl ? (
            <img
              src={player.imageUrl}
              alt={displayName}
              className="scout-reveal-card__img"
              draggable={false}
            />
          ) : (
            <i className={`bi ${player.sprite ?? 'bi-shield-fill'} scout-reveal-card__emoji`} aria-hidden />
          )}
          <div className="scout-reveal-card__holo" aria-hidden />
          <PlayerAgeBadge
            player={{
              kind: 'base',
              age: player.age,
              costBasisUsdc: player.costBasisUsdc ?? (player.age != null ? 1 : 0),
            }}
            className="scout-reveal-card__age"
          />
        </div>
      </div>

      {player.attributes && !player.imageUrl && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 px-3 pb-2">
          {PLAYER_ATTRIBUTE_KEYS.map((key) => (
            <span key={key} className="retro-text text-[10px] flex justify-between gap-2" style={{ color: 'var(--text-secondary)' }}>
              <span>{t(`attrs.${key}`)}</span>
              <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{player.attributes?.[key]}</span>
            </span>
          ))}
        </div>
      )}

      <div className="scout-reveal-card__footer">
        <span className="scout-reveal-card__power">{player.overwall.toLocaleString('pt-BR')}</span>
        <span className="scout-reveal-card__ow-label">{t('overwall', { defaultValue: 'OVERWALL' })}</span>
      </div>
    </Wrapper>
  );
}

export function buildRarityConfig(
  t: (key: string) => string,
): Record<string, ScoutRevealCardConfig> {
  return {
    common: { color: rarityColor('common'), label: t('rarities.common') },
    uncommon: { color: rarityColor('uncommon'), label: t('rarities.uncommon') },
    rare: { color: rarityColor('rare'), label: t('rarities.rare') },
    'super-rare': { color: rarityColor('super-rare'), label: t('rarities.super-rare') },
    epic: { color: rarityColor('epic'), label: t('rarities.epic') },
    legendary: { color: rarityColor('legendary'), label: t('rarities.legendary') },
    mythic: { color: rarityColor('mythic'), label: t('rarities.mythic') },
  };
}
