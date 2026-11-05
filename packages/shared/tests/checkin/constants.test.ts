import { describe, it, expect } from 'vitest';
import {
  utcDayStart,
  nextCheckInAvailableAt,
  countConsecutiveCheckInStreak,
} from '../../src/checkin/constants.js';

describe('checkin day boundary (America/Sao_Paulo, UTC-3)', () => {
  it('keeps the same check-in day across the 00:00 UTC rollover (21:00 BRT)', () => {
    // 20:00 BRT == 23:00 UTC, still the same day in Brazil.
    const beforeRollover = new Date('2026-08-03T23:00:00.000Z');
    // 22:00 BRT == 01:00 UTC next day — still the SAME calendar day in Brazil (Aug 3).
    const afterUtcRollover = new Date('2026-08-04T01:00:00.000Z');

    expect(utcDayStart(beforeRollover).toISOString()).toBe(utcDayStart(afterUtcRollover).toISOString());
  });

  it('rolls over only at real local midnight (03:00 UTC)', () => {
    const justBeforeLocalMidnight = new Date('2026-08-04T02:59:00.000Z'); // 23:59 BRT, Aug 3
    const justAfterLocalMidnight = new Date('2026-08-04T03:00:00.000Z'); // 00:00 BRT, Aug 4

    expect(utcDayStart(justBeforeLocalMidnight).toISOString()).toBe('2026-08-03T00:00:00.000Z');
    expect(utcDayStart(justAfterLocalMidnight).toISOString()).toBe('2026-08-04T00:00:00.000Z');
  });

  it('nextCheckInAvailableAt points at the next real local midnight, not 00:00 UTC', () => {
    const morningClaim = new Date('2026-08-03T11:00:00.000Z'); // 08:00 BRT
    // Next availability should be 00:00 BRT Aug 4 == 03:00 UTC Aug 4 — not 00:00 UTC Aug 4 (21:00 BRT Aug 3).
    expect(nextCheckInAvailableAt(morningClaim).toISOString()).toBe('2026-08-04T03:00:00.000Z');
  });

  it('a claim right after 00:00 UTC does not yet unlock a new check-in (still evening in Brazil)', () => {
    const morningClaim = new Date('2026-08-03T11:00:00.000Z'); // 08:00 BRT claim
    const sameEveningPastUtcMidnight = new Date('2026-08-04T01:30:00.000Z'); // 22:30 BRT, same local day

    expect(utcDayStart(morningClaim).toISOString()).toBe(utcDayStart(sameEveningPastUtcMidnight).toISOString());
  });

  it('streak survives checking status late at night, after the UTC day flips but before local midnight', () => {
    const day1Claim = utcDayStart(new Date('2026-08-03T11:00:00.000Z'));
    const day2Claim = utcDayStart(new Date('2026-08-04T11:00:00.000Z'));
    const checkedAt = new Date('2026-08-04T23:00:00.000Z'); // 20:00 BRT Aug 4 — still day 2 locally

    expect(countConsecutiveCheckInStreak([day2Claim, day1Claim], checkedAt)).toBe(2);
  });
});
