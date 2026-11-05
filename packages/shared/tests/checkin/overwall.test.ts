import { describe, it, expect } from 'vitest';
import { sumActiveCheckInGrants, mergeCheckInBonusIntoPower } from '../../src/checkin/overwall.js';

describe('sumActiveCheckInGrants', () => {
  const now = new Date('2026-07-07T12:00:00.000Z');

  it('sums active grants per user and ignores expired', () => {
    const map = sumActiveCheckInGrants(
      [
        { userId: 'u1', amount: 100, expiresAt: new Date('2026-07-08T00:00:00.000Z') },
        { userId: 'u1', amount: 100, expiresAt: new Date('2026-07-09T00:00:00.000Z') },
        { userId: 'u2', amount: 100, expiresAt: new Date('2026-07-06T00:00:00.000Z') },
      ],
      now,
    );
    expect(map.get('u1')).toBe(200);
    expect(map.has('u2')).toBe(false);
  });
});

describe('mergeCheckInBonusIntoPower', () => {
  it('adds bonus to lineup power and includes bonus-only users', () => {
    const lineup = new Map([['u1', 500]]);
    const bonus = new Map([
      ['u1', 200],
      ['u2', 100],
    ]);
    const merged = mergeCheckInBonusIntoPower(lineup, bonus);
    expect(merged.get('u1')).toBe(700);
    expect(merged.get('u2')).toBe(100);
  });
});
