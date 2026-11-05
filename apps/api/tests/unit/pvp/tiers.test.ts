import { describe, expect, it } from 'vitest';
import { pvpTierFor, pvpWinner } from '../../../../../packages/shared/src/pvp/tiers.js';

describe('pvp tiers', () => {
  it('puts 25773 overwall in ouro', () => {
    expect(pvpTierFor(25773).id).toBe('ouro');
  });

  it('keeps the top of a band in that band', () => {
    expect(pvpTierFor(4999).id).toBe('bronze');
    expect(pvpTierFor(5000).id).toBe('prata');
    expect(pvpTierFor(60000).id).toBe('lenda');
  });

  it('gives the match to the higher overwall and refunds a tie', () => {
    expect(pvpWinner(20000, 18000)).toBe('host');
    expect(pvpWinner(18000, 20000)).toBe('challenger');
    expect(pvpWinner(20000, 20000)).toBe('draw');
  });
});
