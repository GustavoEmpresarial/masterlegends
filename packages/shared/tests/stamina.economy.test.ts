import { describe, it, expect } from 'vitest';
import { STAMINA_MAX } from '../src/schemas/stadium.js';
import { applyStaminaDrift } from '../src/economy/stamina.js';

describe('applyStaminaDrift', () => {
  const now = new Date('2026-06-30T12:00:00Z');
  const oneHourAgo = new Date('2026-06-30T11:00:00Z');

  it('drains legendary on field at 20/h', () => {
    expect(applyStaminaDrift(100, oneHourAgo, now, false, 24, true, 20)).toBe(80);
  });

  it('drains common on field at 8/h', () => {
    expect(applyStaminaDrift(100, oneHourAgo, now, false, 24, true, 8)).toBe(92);
  });

  it('bench with coach recovers without decay', () => {
    const next = applyStaminaDrift(50, oneHourAgo, now, true, 24, false);
    expect(next).toBe(74);
  });

  it('bench without coach stays unchanged', () => {
    expect(applyStaminaDrift(50, oneHourAgo, now, false, 24, false)).toBe(50);
  });

  it('on field does not recover even with coach', () => {
    expect(applyStaminaDrift(50, oneHourAgo, now, true, 24, true, 16)).toBe(34);
  });

  it('clamps at 0 and max', () => {
    const fiveHoursAgo = new Date('2026-06-30T07:00:00Z');
    expect(applyStaminaDrift(10, fiveHoursAgo, now, false, 24, true, 20)).toBe(0);
    expect(applyStaminaDrift(STAMINA_MAX - 1, oneHourAgo, now, true, 24, false)).toBe(STAMINA_MAX);
  });
});
