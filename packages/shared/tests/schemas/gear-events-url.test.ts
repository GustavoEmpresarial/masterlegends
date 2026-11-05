import { describe, it, expect } from 'vitest';
import {
  eventCampaignUpsertSchema,
  eventMediaUrlSchema,
  questRewardSchema,
} from '../../src/schemas/events.js';
import { gearCatalogUpsertSchema } from '../../src/schemas/gear.js';

describe('eventMediaUrlSchema / gear image URL allowlist', () => {
  it('accepts /uploads/ and http(s)', () => {
    expect(eventMediaUrlSchema.parse('/uploads/events/a.png')).toBe('/uploads/events/a.png');
    expect(eventMediaUrlSchema.parse('https://cdn.example/x.png')).toMatch(/^https:/);
  });

  it('rejects javascript: and data: schemes on event media', () => {
    expect(eventMediaUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(eventMediaUrlSchema.safeParse('data:text/html,hi').success).toBe(false);
    expect(eventMediaUrlSchema.safeParse('//evil.example/x').success).toBe(false);
  });

  it('rejects bad imageUrl on gear catalog upsert', () => {
    const bad = gearCatalogUpsertSchema.safeParse({
      slug: 'boots-a',
      nameKey: 'gear.boots.a',
      rarity: 1,
      owBonus: 10,
      priceGmt: 5,
      imageUrl: 'javascript:alert(1)',
    });
    expect(bad.success).toBe(false);

    const ok = gearCatalogUpsertSchema.safeParse({
      slug: 'boots-b',
      nameKey: 'gear.boots.b',
      rarity: 1,
      owBonus: 10,
      priceGmt: 5,
      imageUrl: '/uploads/gear/b.png',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects bad campaign imageUrl', () => {
    const bad = eventCampaignUpsertSchema.safeParse({
      slug: 'camp-1',
      title: 'Camp',
      body: 'hello world body',
      imageUrl: 'javascript:void(0)',
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: '2026-12-31T00:00:00.000Z',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects rewards that are not gmt, usdc, usdt or overwall', () => {
    expect(questRewardSchema.safeParse({ type: 'badge', badgeId: '11111111-1111-1111-1111-111111111111' }).success).toBe(false);
    expect(questRewardSchema.safeParse({ type: 'temp_player', templateId: '11111111-1111-1111-1111-111111111111', days: 7 }).success).toBe(false);
    expect(questRewardSchema.safeParse({ type: 'gmt', amount: 0.0001 }).success).toBe(true);
    expect(questRewardSchema.safeParse({ type: 'overwall', amount: 10 }).success).toBe(true);
  });
});
