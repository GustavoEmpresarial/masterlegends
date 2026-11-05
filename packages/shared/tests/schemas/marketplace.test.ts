import { describe, it, expect } from 'vitest';
import { listingsQuerySchema } from '../../src/schemas/marketplace.js';

describe('listingsQuerySchema', () => {
  it('applies defaults', () => {
    const parsed = listingsQuerySchema.parse({});
    expect(parsed.sortBy).toBe('price');
    expect(parsed.limit).toBe(50);
  });

  it('rejects invalid rarity', () => {
    expect(listingsQuerySchema.safeParse({ rarity: 'invalid' }).success).toBe(false);
  });
});
