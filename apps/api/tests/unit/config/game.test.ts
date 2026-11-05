import { describe, it, expect } from 'vitest';
import {
  calculateUsdcPerHour,
  sumTop11Overwall,
  stadiumFactor,
  calculateUpgradeCost,
} from '../../../src/config/game.js';
import { passLevelFromXp } from '../../../src/config/pass.js';

describe('game config', () => {
  it('calculates upgrade cost', () => {
    expect(calculateUpgradeCost(0)).toBe(100);
    expect(calculateUpgradeCost(1)).toBe(150);
  });

  it('calculates farm MGT per hour', () => {
    const top11 = sumTop11Overwall([5000, 4000, 3000, 2000, 1000, 500, 400, 300, 200, 100, 50]);
    expect(stadiumFactor(5)).toBeCloseTo(1.25);
    const rate = calculateUsdcPerHour(top11, 5);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeCloseTo(top11 * 1.25 * 0.000001);
  });

  it('pass level from xp', () => {
    expect(passLevelFromXp(0)).toBe(1);
    expect(passLevelFromXp(500)).toBe(2);
    expect(passLevelFromXp(2500)).toBe(6);
  });
});
