import { describe, expect, it } from 'vitest';
import { calculatePassPremiumPricing } from '../../../src/modules/pass/pass-premium-pricing.js';

const levels = Array.from({ length: 20 }, (_, i) => ({ xpRequired: (i + 1) * 100 }));
describe('Pass premium progress discount', () => {
  it.each([[0,0,99],[4,0,99],[5,5,94],[9,5,94],[10,10,89],[14,10,89],[15,15,84],[19,15,84],[20,20,79]])('charges the earned price for %i of 20 unlocked levels', (completed, discount, price) => {
    const result = calculatePassPremiumPricing(99, completed * 100, levels);
    expect(result).toMatchObject({ basePriceGmt: 99, completedLevels: completed, totalLevels: 20, completionPct: completed * 5, discountGmt: discount, priceGmt: price });
    expect(result.milestones.map(m => m.requiredLevels)).toEqual([5, 10, 15, 20]);
    expect(result.milestones.map(m => m.discountGmt)).toEqual([5, 10, 15, 20]);
  });
  it('requires reaching the level threshold and does not round 24.9% up to a milestone', () => {
    const hundred = Array.from({ length: 100 }, (_, i) => ({ xpRequired: (i + 1) * 10 }));
    expect(calculatePassPremiumPricing(100, 249, hundred).discountGmt).toBe(0);
    expect(calculatePassPremiumPricing(100, 250, hundred).discountGmt).toBe(5);
  });
  it('counts unlocked levels rather than XP percentage or catalog order', () => {
    const result = calculatePassPremiumPricing(99, 100, [{ xpRequired: 5000 },{ xpRequired: 100 },{ xpRequired: 200 },{ xpRequired: 300 }]);
    expect(result).toMatchObject({ completedLevels: 1, completionPct: 25, priceGmt: 94 });
  });
  it('keeps discounts fixed in GMT, regardless of configured price', () => {
    expect(calculatePassPremiumPricing(200, 9999, levels).priceGmt).toBe(180);
    expect(calculatePassPremiumPricing(100, 9999, levels).priceGmt).toBe(80);
  });
  it('caps the discount at the price and never returns a negative charge', () => {
    expect(calculatePassPremiumPricing(7, 9999, levels)).toMatchObject({ discountGmt: 7, priceGmt: 0 });
    expect(calculatePassPremiumPricing(0, 9999, levels).priceGmt).toBe(0);
  });
  it('preserves the smallest GMT remainder without floating-point truncation', () => {
    expect(calculatePassPremiumPricing(5.00000001, 500, levels).priceGmt).toBe(0.00000001);
    expect(calculatePassPremiumPricing(99.123456, 9999, levels).priceGmt).toBe(79.123456);
  });
  it('handles uneven season sizes, empty seasons and invalid XP', () => {
    expect(calculatePassPremiumPricing(99, 2, [{xpRequired:1},{xpRequired:2},{xpRequired:3}])).toMatchObject({ completedLevels:2, discountGmt:10 });
    expect(calculatePassPremiumPricing(99, 9999, []).discountGmt).toBe(0);
    expect(calculatePassPremiumPricing(99, -100, levels).discountGmt).toBe(0);
    expect(calculatePassPremiumPricing(99, NaN, levels).discountGmt).toBe(0);
  });
  it.each([-1, NaN, Infinity])('rejects an invalid configured base price %s', price => {
    expect(() => calculatePassPremiumPricing(price, 9999, levels)).toThrow();
  });
});
