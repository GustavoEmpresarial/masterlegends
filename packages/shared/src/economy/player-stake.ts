import { splitFeeRate } from './money.js';

import { RARITY_MINT_GMT, type ScoutRarityId } from './scout.js';

/** Share of the card value locked as stake. Half the league market price. */
export const PLAYER_STAKE_PCT_BY_RARITY: Record<ScoutRarityId, number> = {
  common: 50,
  uncommon: 50,
  rare: 50,
  'super-rare': 50,
  epic: 50,
  legendary: 50,
};

function stakeOf(valueGmt: number, percent: number): number {
  return Number(((valueGmt * percent) / 100).toFixed(6));
}

/** GMT locked to field a player. Half the league market price. */
export const PLAYER_STAKE_GMT_BY_RARITY = {
  common: stakeOf(RARITY_MINT_GMT.common, PLAYER_STAKE_PCT_BY_RARITY.common),
  uncommon: stakeOf(RARITY_MINT_GMT.uncommon, PLAYER_STAKE_PCT_BY_RARITY.uncommon),
  rare: stakeOf(RARITY_MINT_GMT.rare, PLAYER_STAKE_PCT_BY_RARITY.rare),
  'super-rare': stakeOf(RARITY_MINT_GMT['super-rare'], PLAYER_STAKE_PCT_BY_RARITY['super-rare']),
  epic: stakeOf(RARITY_MINT_GMT.epic, PLAYER_STAKE_PCT_BY_RARITY.epic),
  legendary: stakeOf(RARITY_MINT_GMT.legendary, PLAYER_STAKE_PCT_BY_RARITY.legendary),
} as const;

export type PlayerStakeRarityId = keyof typeof PLAYER_STAKE_GMT_BY_RARITY;

/** Matches API RARITY_NAMES index order. */
export const PLAYER_STAKE_GMT_BY_INDEX = [
  PLAYER_STAKE_GMT_BY_RARITY.common,
  PLAYER_STAKE_GMT_BY_RARITY.uncommon,
  PLAYER_STAKE_GMT_BY_RARITY.rare,
  PLAYER_STAKE_GMT_BY_RARITY['super-rare'],
  PLAYER_STAKE_GMT_BY_RARITY.epic,
  PLAYER_STAKE_GMT_BY_RARITY.legendary,
] as const;

export function stakeGmtForRarityIndex(rarityIndex: number): number {
  if (!Number.isInteger(rarityIndex) || rarityIndex < 0) {
    return PLAYER_STAKE_GMT_BY_RARITY.common;
  }
  if (rarityIndex >= PLAYER_STAKE_GMT_BY_INDEX.length) {
    return PLAYER_STAKE_GMT_BY_RARITY.legendary;
  }
  return PLAYER_STAKE_GMT_BY_INDEX[rarityIndex] ?? PLAYER_STAKE_GMT_BY_RARITY.common;
}

export function stakeGmtForRarityName(rarity: string): number {
  const key = rarity.trim().toLowerCase();
  if (key === 'mythic') return PLAYER_STAKE_GMT_BY_RARITY.legendary;
  if (key in PLAYER_STAKE_GMT_BY_RARITY) {
    return PLAYER_STAKE_GMT_BY_RARITY[key as PlayerStakeRarityId];
  }
  return PLAYER_STAKE_GMT_BY_RARITY.common;
}

/** Early exit burns this percent on the stake day, then 1 point less each full day. */
export const STAKE_EXIT_PENALTY_START_PCT = 30;
export const STAKE_EXIT_PENALTY_DAILY_DROP_PCT = 1;
const STAKE_EXIT_DAY_MS = 24 * 60 * 60 * 1000;

export interface StakeExitSplit {
  daysHeld: number;
  penaltyPercent: number;
  /** Quantized GMT burned from the locked stake. */
  penaltyGmt: string;
  /** Quantized GMT returned to the available balance. */
  returnedGmt: string;
}

/** Full days since the stake. The stake day itself is 0. */
export function stakeDaysHeld(stakedAt: Date | string | number, now = Date.now()): number {
  const start = typeof stakedAt === 'number' ? stakedAt : new Date(stakedAt).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.floor(Math.max(0, now - start) / STAKE_EXIT_DAY_MS);
}

/** 30% on day 0, 29% after 24h, 0% from day 30 on. */
export function stakeExitPenaltyPercent(stakedAt: Date | string | number, now = Date.now()): number {
  const days = stakeDaysHeld(stakedAt, now);
  return Math.max(0, STAKE_EXIT_PENALTY_START_PCT - days * STAKE_EXIT_PENALTY_DAILY_DROP_PCT);
}

/** Splits a stake so the burned part and the returned part add back to the amount. */
export function stakeExitSplit(
  amount: number | string,
  stakedAt: Date | string | number,
  now = Date.now(),
): StakeExitSplit {
  const daysHeld = stakeDaysHeld(stakedAt, now);
  const penaltyPercent = Math.max(
    0,
    STAKE_EXIT_PENALTY_START_PCT - daysHeld * STAKE_EXIT_PENALTY_DAILY_DROP_PCT,
  );
  const split = splitFeeRate('gmt', amount, (penaltyPercent / 100).toFixed(2));
  return {
    daysHeld,
    penaltyPercent,
    penaltyGmt: split.fee,
    returnedGmt: split.net,
  };
}
