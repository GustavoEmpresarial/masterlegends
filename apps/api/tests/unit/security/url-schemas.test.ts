import { describe, it, expect } from 'vitest';
import { eventMediaUrlSchema, gearCatalogUpsertSchema } from '@mll/shared';

/** API-facing re-export smoke: shared allowlists stay wired through @mll/shared. */
describe('security URL allowlists via @mll/shared', () => {
  it('rejects javascript: on event media URLs', () => {
    expect(eventMediaUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
  });

  it('rejects javascript: on gear catalog imageUrl', () => {
    const parsed = gearCatalogUpsertSchema.safeParse({
      slug: 'boots-sec',
      nameKey: 'gear.boots.sec',
      rarity: 0,
      owBonus: 1,
      priceGmt: 1,
      imageUrl: 'javascript:void(0)',
    });
    expect(parsed.success).toBe(false);
  });
});
