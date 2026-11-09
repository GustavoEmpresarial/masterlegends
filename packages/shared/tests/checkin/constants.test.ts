import { describe, it, expect } from 'vitest';
import {
  utcDayStart,
  nextCheckInAvailableAt,
  countConsecutiveCheckInStreak,
} from '../../src/checkin/constants.js';

describe('checkin day boundary (UTC midnight)', () => {
  it('rolls the check-in day at 00:00 UTC', () => {
    const beforeMidnight = new Date('2026-08-03T23:00:00.000Z');
    const afterMidnight = new Date('2026-08-04T01:00:00.000Z');

    expect(utcDayStart(beforeMidnight).toISOString()).toBe('2026-08-03T00:00:00.000Z');
    expect(utcDayStart(afterMidnight).toISOString()).toBe('2026-08-04T00:00:00.000Z');
  });

  it('keeps the same day until the UTC date changes', () => {
    const justBefore = new Date('2026-08-03T23:59:00.000Z');
    const justAfter = new Date('2026-08-04T00:00:00.000Z');

    expect(utcDayStart(justBefore).toISOString()).toBe('2026-08-03T00:00:00.000Z');
    expect(utcDayStart(justAfter).toISOString()).toBe('2026-08-04T00:00:00.000Z');
  });

  it('nextCheckInAvailableAt points at the next UTC midnight', () => {
    const morningClaim = new Date('2026-08-03T11:00:00.000Z');
    expect(nextCheckInAvailableAt(morningClaim).toISOString()).toBe('2026-08-04T00:00:00.000Z');
  });

  it('a claim after 00:00 UTC is already the next check-in day', () => {
    const morningClaim = new Date('2026-08-03T11:00:00.000Z');
    const afterUtcMidnight = new Date('2026-08-04T01:30:00.000Z');

    expect(utcDayStart(morningClaim).toISOString()).not.toBe(utcDayStart(afterUtcMidnight).toISOString());
  });

  it('streak counts consecutive UTC days', () => {
    const day1Claim = utcDayStart(new Date('2026-08-03T11:00:00.000Z'));
    const day2Claim = utcDayStart(new Date('2026-08-04T11:00:00.000Z'));
    const checkedAt = new Date('2026-08-04T23:00:00.000Z');

    expect(countConsecutiveCheckInStreak([day2Claim, day1Claim], checkedAt)).toBe(2);
  });
});
