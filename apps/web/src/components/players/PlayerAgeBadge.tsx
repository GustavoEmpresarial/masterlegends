import type { CSSProperties } from 'react';
import { PLAYER_CAREER_START_AGE } from '@mll/shared';

export type PlayerAgeFields = {
  kind?: string;
  costBasisUsdc?: number | null;
  age?: number | null;
  roiPct?: number | null;
};

/** True when the player has a paid career cycle and an age to show. */
export function hasPlayerAge(p: PlayerAgeFields | null | undefined): boolean {
  if (!p) return false;
  if (p.kind === 'nft') return false;
  const cost = Number(p.costBasisUsdc ?? 0);
  return cost > 0 && p.age != null && Number.isFinite(p.age);
}

export function resolvePlayerAge(p: PlayerAgeFields | null | undefined): number | null {
  if (!hasPlayerAge(p)) return null;
  return p!.age ?? PLAYER_CAREER_START_AGE;
}

/**
 * Compact gold age chip for player cards / rows.
 * Renders nothing when the player has no career cycle.
 */
export function PlayerAgeBadge({
  player,
  showRoi = false,
  className = '',
  style,
}: {
  player: PlayerAgeFields | null | undefined;
  showRoi?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const age = resolvePlayerAge(player);
  if (age == null) return null;

  const roi = player?.roiPct;
  const label =
    showRoi && roi != null && Number.isFinite(roi)
      ? `${age}a · ${Number.isInteger(roi) ? roi : roi.toFixed(1)}%`
      : `${age}a`;

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 pixel-badge text-[10px] leading-none ${className}`.trim()}
      style={{
        borderColor: 'var(--gold)',
        color: 'var(--gold)',
        background: 'rgba(0,0,0,0.75)',
        ...style,
      }}
      title={`Idade ${age} (carreira)`}
    >
      {label}
    </span>
  );
}
