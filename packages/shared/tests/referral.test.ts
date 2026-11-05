import { describe, expect, it } from 'vitest';
import {
  collectReferrerAncestors,
  depositCommission,
  referralLoopReason,
  referralSelfReason,
  sharesRegistrationIp,
} from '../src/economy/referral.js';

describe('deposit commission', () => {
  it('pays 5% of a USDC deposit as USDT, rounded down', () => {
    const split = depositCommission(10, 0.05);
    expect(split.gross).toBe('10.000000');
    expect(split.commission).toBe('0.500000');
    expect(split.belowMinimum).toBe(false);
  });

  it('rejects dust below the USDT minimum', () => {
    const split = depositCommission('0.000010', 0.05);
    expect(split.commission).toBe('0.000000');
    expect(split.belowMinimum).toBe(true);
  });
});

describe('referral guards', () => {
  it('blocks self referral by id, email, or wallet', () => {
    expect(referralSelfReason({ id: 'a' }, { id: 'a' })).toBe('self');
    expect(referralSelfReason({ id: 'a', email: 'A@b.com' }, { id: 'b', email: 'a@b.com' })).toBe('self');
    expect(referralSelfReason({ id: 'a', wallet: '0xABC' }, { id: 'b', wallet: '0xabc' })).toBe('self');
    expect(referralSelfReason({ id: 'a', email: 'a@b.com' }, { id: 'b', email: 'c@d.com' })).toBeNull();
  });

  it('blocks a loop when the referred user is already an ancestor', () => {
    expect(referralLoopReason(['c', 'b'], 'b')).toBe('loop');
    expect(referralLoopReason(['c'], 'b')).toBeNull();
  });

  it('blocks a signup from an IP the referrer already used', () => {
    expect(sharesRegistrationIp(['1.1.1.1'], '1.1.1.1')).toBe(true);
    expect(sharesRegistrationIp(['1.1.1.1'], '2.2.2.2')).toBe(false);
    expect(sharesRegistrationIp(['1.1.1.1'], '  ')).toBe(false);
  });

  it('walks the referrer chain once and stops on a repeat', async () => {
    const parents: Record<string, string | null> = { b: 'a', a: 'b' };
    const ids = await collectReferrerAncestors('b', async (id) => parents[id] ?? null);
    expect(ids).toEqual(['a', 'b']);
  });
});
