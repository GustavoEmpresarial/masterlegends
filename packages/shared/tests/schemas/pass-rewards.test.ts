import { describe, expect, it } from 'vitest';
import { passLevelConfigSchema, passLevelsSchema, passRewardBlockSchema } from '../../src/schemas/pass-season';
const item = { level: 1, xpRequired: 0, rewardType: 'catalog_item', rewardLabel: 'Carta', rewardItemId: '10000000-0000-4000-8000-000000000001', quantity: 2 };
describe('pass rewards', () => {
  it.each(['catalog_item', 'gear', 'shop_item'])('requires an identity for %s', rewardType => {
    expect(passLevelConfigSchema.safeParse({ ...item, rewardType }).success).toBe(true);
    expect(passLevelConfigSchema.safeParse({ ...item, rewardType, rewardItemId: undefined }).success).toBe(false);
  });
  it.each([0, -1, 101, 1.5])('rejects invalid quantity %s', quantity => expect(passLevelConfigSchema.safeParse({ ...item, quantity }).success).toBe(false));
  it('accepts all six random player rarities', () => expect(passLevelConfigSchema.safeParse({ ...item, rewardType: 'player', playerRarity: 5 }).success).toBe(true));
  it('rejects duplicate level identifiers', () => expect(passLevelsSchema.safeParse([item, item]).success).toBe(false));
  it('requires positive balance prizes', () => expect(passLevelConfigSchema.safeParse({ ...item, rewardType: 'usdc', usdcAmount: 0 }).success).toBe(false));
  it('validates range item identity too', () => expect(passRewardBlockSchema.safeParse({ fromLevel: 1, toLevel: 2, rewardType: 'gear', rewardLabel: 'Gear' }).success).toBe(false));
});
