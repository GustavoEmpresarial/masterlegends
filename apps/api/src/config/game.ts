import { MAX_BUILDING_LEVEL, MERGE_INPUT_COUNT, MERGE_LADDER, MERGE_LEGENDARY_VALUE_GMT, SCOUT_COST_USDC, SCOUT_RARITY_ORDER, SCOUT_RARITY_WEIGHTS } from '@mll/shared';
import { secureRandom } from '../common/lib/secure-random.js';

export { SCOUT_COST_USDC };

/** @deprecated use SCOUT_COST_USDC */
export const SCOUT_COST_MGT = SCOUT_COST_USDC;

export const RARITY_NAMES = ['common', 'uncommon', 'rare', 'super-rare', 'epic', 'legendary'] as const;
export const POSITION_NAMES = ['GK', 'DEF', 'MID', 'FW', 'LAT'] as const;

/** Mythic is not an official tier; it shares the legendary index and band. */
export const RARITY_TO_INT: Record<(typeof RARITY_NAMES)[number] | 'mythic', number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  'super-rare': 3,
  epic: 4,
  legendary: 5,
  mythic: 5,
};

export const GAME_CONFIG = Object.freeze({
  MINT_PRICE_USDC: 10,
  SCOUT_COST_USDC,
  MAX_MINT_PER_TX: 10,
  REFERRAL_BONUS_PCT: 0.05,
  MAX_BUILDING_LEVEL,
  MARKETPLACE_FEE_BPS: 1000,
  WITHDRAWAL_FEE_PCT: 0.05,
  PASS_PREMIUM_USDC: 500,
  /** @deprecated use PASS_PREMIUM_USDC */
  PASS_PREMIUM_MGT: 500,
  FARM_OVERWALL_FACTOR: 0.000001,
  FARM_STADIUM_BONUS: 0.05,
  STAMINA: {
    MAX: 100,
    PVP_MATCH_COST: 20,
    FARM_PER_HOUR: 10,
    MINIGAME_RECOVERY: 10,
    MIN_TO_PVP: 20,
  },
  PASS_XP: {
    scoutMint: 150,
    marketBuy: 120,
    marketSell: 80,
    merge: 80,
  },
  MERGE: {
    INPUT_COUNT: MERGE_INPUT_COUNT,
    LADDER: MERGE_LADDER,
    LEGENDARY_VALUE_GMT: MERGE_LEGENDARY_VALUE_GMT,
    OVERWALL_RANGES: [
      [1, 10],
      [11, 20],
      [21, 40],
      [80, 160],
      [320, 640],
      [1280, 2560],
    ] as const,
  },
  RARITY_DISTRIBUTION: {
    ...Object.fromEntries(
      SCOUT_RARITY_ORDER.map((id) => [id, SCOUT_RARITY_WEIGHTS[id]]),
    ),
  } as Record<(typeof RARITY_NAMES)[number], number>,
});

export function calculateUpgradeCost(currentLevel: number): number {
  if (currentLevel < 0) {
    throw new Error('Invalid building level');
  }
  return Math.floor(100 * Math.pow(1.5, currentLevel));
}

export function stadiumFactor(stadiumLvl: number): number {
  return 1 + stadiumLvl * GAME_CONFIG.FARM_STADIUM_BONUS;
}

/** USDC per hour from top-11 overwall sum and stadium level (dev-spec §5.3). */
export function calculateUsdcPerHour(top11Overwall: number, stadiumLvl: number): number {
  return top11Overwall * stadiumFactor(stadiumLvl) * GAME_CONFIG.FARM_OVERWALL_FACTOR;
}

/** USDC per hour usando bônus do estádio configurado por template (admin). */
export function calculateUsdcPerHourWithBonus(top11Overwall: number, bonusPct: number): number {
  return top11Overwall * (1 + bonusPct) * GAME_CONFIG.FARM_OVERWALL_FACTOR;
}

/** @deprecated use calculateUsdcPerHour */
export const calculateMgtPerHour = calculateUsdcPerHour;

export function sumTop11Overwall(overwalls: number[]): number {
  return [...overwalls].sort((a, b) => b - a).slice(0, 11).reduce((sum, v) => sum + v, 0);
}

/** Uniform roll in the official overwall band for the output rarity index (1–5). */
export function rollMergeOverwall(newRarity: number, rand: () => number = secureRandom): number {
  const ranges = GAME_CONFIG.MERGE.OVERWALL_RANGES;
  if (newRarity < 1 || newRarity >= ranges.length) {
    throw new Error('Invalid merge output rarity');
  }
  const [min, max] = ranges[newRarity]!;
  return Math.floor(rand() * (max - min + 1)) + min;
}
