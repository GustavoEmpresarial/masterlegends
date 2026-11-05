import { describe, it, expect } from 'vitest';
import {
  SCOUT_RARITY_WEIGHTS,
  SCOUT_COST_GMT,
  RARITY_MINT_GMT,
  buildScoutRules,
  careerCostBasisForRarity,
  mintGmtForRarityIndex,
  isOverwallInScoutRange,
  mintSchema,
  parseScoutRarityWeights,
  rollScoutOverwall,
  rollScoutRarityIndex,
} from '@mll/shared';

describe('scout economy', () => {
  it('publishes the scout chance table', () => {
    const rules = buildScoutRules();
    const byId = Object.fromEntries(rules.rarities.map((r) => [r.id, r.chancePct]));
    expect(byId).toEqual({
      common: 50,
      uncommon: 30,
      rare: 10,
      'super-rare': 6,
      epic: 3,
      legendary: 1,
    });
  });

  it('cobra 1 GMT no mint e a tabela no marketplace', () => {
    expect(SCOUT_COST_GMT).toBe(1);
    expect(mintGmtForRarityIndex(0)).toBe(0.25);
    expect(mintGmtForRarityIndex(1)).toBe(1.25);
    expect(mintGmtForRarityIndex(2)).toBe(6.35);
    expect(mintGmtForRarityIndex(3)).toBe(31.25);
    expect(mintGmtForRarityIndex(4)).toBe(156.25);
    expect(mintGmtForRarityIndex(5)).toBe(750);
    expect(RARITY_MINT_GMT).toEqual({
      common: 0.25,
      uncommon: 1.25,
      rare: 6.35,
      'super-rare': 31.25,
      epic: 156.25,
      legendary: 750,
    });
    expect(careerCostBasisForRarity(5, SCOUT_COST_GMT, 0)).toBe(1);
    expect(careerCostBasisForRarity(1, SCOUT_COST_GMT, 1.8)).toBe(2.8);
    const rules = buildScoutRules();
    expect(rules.rarities.map((rule) => rule.mintCostGmt)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(rules.effectiveCostUsdc).toBe(1);
  });

  it('buildScoutRules exposes the renormalized legendary chance', () => {
    const rules = buildScoutRules();
    const legendary = rules.rarities.find((r) => r.id === 'legendary');
    const total = Object.values(SCOUT_RARITY_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(legendary?.chancePct).toBeCloseTo((SCOUT_RARITY_WEIGHTS.legendary / total) * 100, 5);
    expect(legendary?.overwallMin).toBe(1280);
    expect(legendary?.overwallMax).toBe(2560);
    const mins = rules.rarities.map((r) => r.overwallMin);
    const maxs = rules.rarities.map((r) => r.overwallMax);
    expect(mins).toEqual([1, 11, 21, 80, 320, 1280]);
    expect(maxs).toEqual([10, 20, 40, 160, 640, 2560]);
    for (let i = 1; i < mins.length; i++) {
      expect(mins[i]!).toBeGreaterThan(maxs[i - 1]!);
    }
  });

  it('rolls common near 50% and legendary near 1%', () => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 10_000; i++) {
      counts[rollScoutRarityIndex(Math.random)]! += 1;
    }
    expect(counts[0]! / 10_000).toBeGreaterThan(0.42);
    expect(counts[0]! / 10_000).toBeLessThan(0.58);
    expect(counts[5]! / 10_000).toBeGreaterThan(0.002);
    expect(counts[5]! / 10_000).toBeLessThan(0.025);
  });

  it('rollScoutOverwall stays within rarity range', () => {
    for (let i = 0; i < 6; i++) {
      const ow = rollScoutOverwall(i, () => 0.5);
      expect(isOverwallInScoutRange(i, ow)).toBe(true);
    }
  });


  it('buildScoutRules exposes stamina drain increasing with rarity', () => {
    const rules = buildScoutRules();
    const drains = rules.rarities.map((r) => r.staminaDrainPerHour);
    expect(drains).toEqual([8, 9, 10, 12, 16, 20]);
    for (let i = 1; i < drains.length; i++) {
      expect(drains[i]!).toBeGreaterThan(drains[i - 1]!);
    }
  });

  it('uses configured weights and falls back when they are invalid', () => {
    const onlyLegendary = {
      common: 0,
      uncommon: 0,
      rare: 0,
      'super-rare': 0,
      epic: 0,
      legendary: 1,
    };
    const rules = buildScoutRules(0, onlyLegendary);
    expect(rules.rarities.find((r) => r.id === 'legendary')?.chancePct).toBeCloseTo(100, 5);
    expect(rollScoutRarityIndex(() => 0.5, onlyLegendary)).toBe(5);
    expect(parseScoutRarityWeights({ common: -1 })).toEqual(SCOUT_RARITY_WEIGHTS);
    expect(parseScoutRarityWeights(null)).toEqual(SCOUT_RARITY_WEIGHTS);
  });

  it('mintSchema rejects client-supplied rarity', () => {
    expect(() => mintSchema.parse({ quantity: 1, rarity: 'legendary' })).toThrow();
  });
});
