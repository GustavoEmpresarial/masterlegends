import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QuestPeriod } from '@mll/shared';
import { isWithinWindow, periodKeyFor } from '../../../src/modules/events/period.js';

describe('periodKeyFor / isWithinWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T15:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('daily key is UTC YYYY-MM-DD', () => {
    expect(periodKeyFor(QuestPeriod.DAILY)).toBe('2026-07-18');
  });

  it('weekly key uses ISO week for mid-week', () => {
    // 2026-07-18 is Saturday → ISO week 29
    expect(periodKeyFor(QuestPeriod.WEEKLY)).toBe('2026-W29');
  });

  it('weekly key for Sunday uses previous Thursday week year rules', () => {
    vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z')); // Sunday
    expect(periodKeyFor(QuestPeriod.WEEKLY)).toBe('2026-W29');
  });

  it('weekly key for early January stays stable', () => {
    vi.setSystemTime(new Date('2026-01-04T12:00:00.000Z')); // Sunday
    expect(periodKeyFor(QuestPeriod.WEEKLY)).toBe('2026-W01');
  });

  it('weekly key for Sunday uses ||7 (not truthy day)', () => {
    // 2025-01-05 Sunday: ISO W01. Mutating (getUTCDay()||7)→true yields W02.
    vi.setSystemTime(new Date('2025-01-05T12:00:00.000Z'));
    expect(periodKeyFor(QuestPeriod.WEEKLY)).toBe('2025-W01');
  });

  it('none/unknown period returns once', () => {
    expect(periodKeyFor(QuestPeriod.NONE)).toBe('once');
    expect(periodKeyFor('custom')).toBe('once');
  });

  it('isWithinWindow allows open-ended bounds', () => {
    expect(isWithinWindow(null, null)).toBe(true);
    expect(isWithinWindow(undefined, undefined)).toBe(true);
  });

  it('isWithinWindow rejects before start and after end', () => {
    const start = new Date('2026-07-19T00:00:00.000Z');
    const end = new Date('2026-07-17T00:00:00.000Z');
    expect(isWithinWindow(start, null)).toBe(false);
    expect(isWithinWindow(null, end)).toBe(false);
  });

  it('isWithinWindow includes exact boundary instants', () => {
    const t = new Date('2026-07-18T15:30:00.000Z');
    expect(isWithinWindow(t, null, t)).toBe(true);
    expect(isWithinWindow(null, t, t)).toBe(true);
  });

  it('isWithinWindow accepts current time inside range', () => {
    expect(
      isWithinWindow(
        new Date('2026-07-01T00:00:00.000Z'),
        new Date('2026-07-31T00:00:00.000Z'),
      ),
    ).toBe(true);
  });
});
