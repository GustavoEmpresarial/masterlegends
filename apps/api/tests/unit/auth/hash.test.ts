import { describe, it, expect } from 'vitest';
import { generatePlainToken, hashToken } from '../../../src/modules/auth/tokens/hash.js';

describe('token hash helpers', () => {
  it('generates hex token of expected length', () => {
    const t = generatePlainToken(16);
    expect(t).toHaveLength(32);
  });

  it('hashes deterministically', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('def'));
  });
});
