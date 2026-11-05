import { describe, expect, it } from 'vitest';
import { lockerPace } from '../../../src/components/stadium/StadiumPlayfieldLayer';

describe('lockerPace', () => {
  it('walks back and forth and turns around', () => {
    let min = 100;
    let max = 0;
    const facings = new Set<number>();
    for (let t = 0; t < 12; t += 0.05) {
      const pace = lockerPace('ronaldo', 1, t, 50);
      min = Math.min(min, pace.xPct);
      max = Math.max(max, pace.xPct);
      facings.add(pace.facing);
      expect(pace.xPct).toBeGreaterThanOrEqual(6);
      expect(pace.xPct).toBeLessThanOrEqual(94);
    }
    expect(max - min).toBeGreaterThan(3);
    expect(facings.has(1)).toBe(true);
    expect(facings.has(-1)).toBe(true);
  });
});