export const SCOUT_LAP_MS = 2800;
export const SCOUT_LANDING_MS = 900;

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'super-rare', 'epic', 'legendary', 'mythic'] as const;

export type ScoutRarity = (typeof RARITY_ORDER)[number];

export function highestRarity(rarities: string[]): ScoutRarity {
  let best = 0;
  for (const rarity of rarities) {
    const index = RARITY_ORDER.indexOf(rarity as ScoutRarity);
    if (index > best) best = index;
  }
  return RARITY_ORDER[best] ?? 'common';
}

export function rarityColor(rarity: ScoutRarity): string {
  const colors: Record<ScoutRarity, string> = {
    common: 'var(--rarity-common)',
    uncommon: 'var(--rarity-uncommon)',
    rare: 'var(--rarity-rare)',
    'super-rare': 'var(--rarity-super-rare)',
    epic: 'var(--rarity-epic)',
    legendary: 'var(--rarity-legendary)',
    mythic: 'var(--rarity-mythic)',
  };
  return colors[rarity];
}
