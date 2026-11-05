import { describe, it, expect } from 'vitest';
import { createClubSchema, upgradeBuildingParamsSchema } from '../../src/schemas/club.js';

describe('club schemas', () => {
  it('accepts valid club name', () => {
    expect(createClubSchema.safeParse({ name: 'My Club-1' }).success).toBe(true);
  });

  it('rejects invalid characters in club name', () => {
    expect(createClubSchema.safeParse({ name: 'bad@name' }).success).toBe(false);
  });

  it('accepts building param', () => {
    expect(upgradeBuildingParamsSchema.safeParse({ building: 'stadium' }).success).toBe(true);
  });
});
