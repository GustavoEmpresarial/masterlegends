export interface PvpTier {
  id: string;
  label: string;
  min: number;
  /** Exclusive. Null means no ceiling. */
  max: number | null;
}

/** Faixas fechadas à esquerda. O duelo só acontece dentro da mesma faixa. */
export const PVP_TIERS: readonly PvpTier[] = [
  { id: 'bronze', label: 'BRONZE', min: 0, max: 5_000 },
  { id: 'prata', label: 'PRATA', min: 5_000, max: 15_000 },
  { id: 'ouro', label: 'OURO', min: 15_000, max: 30_000 },
  { id: 'elite', label: 'ELITE', min: 30_000, max: 60_000 },
  { id: 'lenda', label: 'LENDA', min: 60_000, max: null },
];

export const PVP_MIN_STAKE_GMT = 1;

export function pvpTierFor(overwall: number): PvpTier {
  const power = Number.isFinite(overwall) && overwall > 0 ? overwall : 0;
  for (let i = PVP_TIERS.length - 1; i >= 0; i -= 1) {
    const tier = PVP_TIERS[i]!;
    if (power >= tier.min) return tier;
  }
  return PVP_TIERS[0]!;
}

export function pvpTierRangeLabel(tier: PvpTier): string {
  if (tier.max == null) return `${tier.min.toLocaleString('pt-BR')}+ OW`;
  const ceiling = tier.max - 1;
  return `${tier.min.toLocaleString('pt-BR')} – ${ceiling.toLocaleString('pt-BR')} OW`;
}

/** Maior overwall ganha. Empate devolve as duas apostas. */
export function pvpWinner(hostOverwall: number, challengerOverwall: number): 'host' | 'challenger' | 'draw' {
  const diff = hostOverwall - challengerOverwall;
  if (!Number.isFinite(diff) || Math.abs(diff) < 0.0001) return 'draw';
  return diff > 0 ? 'host' : 'challenger';
}
