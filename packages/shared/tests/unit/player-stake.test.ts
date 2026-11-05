import { describe, expect, it } from 'vitest';
import {
  PLAYER_STAKE_GMT_BY_RARITY,
  stakeExitPenaltyPercent,
  stakeExitSplit,
  stakeGmtForRarityIndex,
  stakeGmtForRarityName,
} from '../../src/economy/player-stake';

describe('player stake GMT by rarity', () => {
  it('maps rarity names', () => {
    expect(stakeGmtForRarityName('common')).toBe(0.125);
    expect(stakeGmtForRarityName('uncommon')).toBe(0.625);
    expect(stakeGmtForRarityName('rare')).toBe(3.175);
    expect(stakeGmtForRarityName('super-rare')).toBe(15.625);
    expect(stakeGmtForRarityName('epic')).toBe(78.125);
    expect(stakeGmtForRarityName('legendary')).toBe(375);
    expect(stakeGmtForRarityName('mythic')).toBe(375);
  });

  it('maps rarity indexes', () => {
    expect(stakeGmtForRarityIndex(0)).toBe(PLAYER_STAKE_GMT_BY_RARITY.common);
    expect(stakeGmtForRarityIndex(1)).toBe(PLAYER_STAKE_GMT_BY_RARITY.uncommon);
    expect(stakeGmtForRarityIndex(2)).toBe(PLAYER_STAKE_GMT_BY_RARITY.rare);
    expect(stakeGmtForRarityIndex(3)).toBe(PLAYER_STAKE_GMT_BY_RARITY['super-rare']);
    expect(stakeGmtForRarityIndex(4)).toBe(PLAYER_STAKE_GMT_BY_RARITY.epic);
    expect(stakeGmtForRarityIndex(5)).toBe(PLAYER_STAKE_GMT_BY_RARITY.legendary);
    expect(stakeGmtForRarityIndex(99)).toBe(PLAYER_STAKE_GMT_BY_RARITY.legendary);
  });
});

describe('stake exit penalty', () => {
  const start = Date.parse('2026-10-08T12:00:00.000Z');

  it('burns 30% when the stake is removed the same day', () => {
    const split = stakeExitSplit(1, start, start);
    expect(split.penaltyPercent).toBe(30);
    expect(split.daysHeld).toBe(0);
    expect(split.penaltyGmt).toBe('0.30000000');
    expect(split.returnedGmt).toBe('0.70000000');
  });

  it('drops one point per full day and reaches zero on day 30', () => {
    const day = 24 * 60 * 60 * 1000;
    expect(stakeExitPenaltyPercent(start, start + day - 1)).toBe(30);
    expect(stakeExitPenaltyPercent(start, start + day)).toBe(29);
    expect(stakeExitPenaltyPercent(start, start + 29 * day)).toBe(1);
    expect(stakeExitPenaltyPercent(start, start + 30 * day)).toBe(0);
    expect(stakeExitPenaltyPercent(start, start + 40 * day)).toBe(0);
    const free = stakeExitSplit(200, start, start + 30 * day);
    expect(free.penaltyGmt).toBe('0.00000000');
    expect(free.returnedGmt).toBe('200.00000000');
  });

  it('splits a legendary stake without leftover dust', () => {
    const split = stakeExitSplit(200, start, start);
    expect(split.penaltyGmt).toBe('60.00000000');
    expect(split.returnedGmt).toBe('140.00000000');
  });
});
