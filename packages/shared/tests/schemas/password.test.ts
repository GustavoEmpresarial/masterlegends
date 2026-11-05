import { describe, it, expect } from 'vitest';
import {
  checkPasswordStrength,
  isPasswordStrong,
  strongPasswordSchema,
  VALID_TEST_PASSWORD,
} from '../../src/schemas/password.js';

describe('password strength', () => {
  it('accepts valid test password', () => {
    expect(isPasswordStrong(VALID_TEST_PASSWORD)).toBe(true);
    expect(strongPasswordSchema.safeParse(VALID_TEST_PASSWORD).success).toBe(true);
  });

  it('rejects password without special char', () => {
    expect(isPasswordStrong('Test1pass')).toBe(false);
  });

  it('accepts password without dot', () => {
    expect(isPasswordStrong('Test1!pass')).toBe(true);
  });

  it('rejects password without uppercase', () => {
    expect(isPasswordStrong('test1!pass')).toBe(false);
  });

  it('rejects password without lowercase', () => {
    expect(isPasswordStrong('TEST1!PASS')).toBe(false);
  });

  it('rejects password without number', () => {
    expect(isPasswordStrong('Test!pass')).toBe(false);
  });

  it('rejects short password', () => {
    const rules = checkPasswordStrength('Ab1!');
    expect(rules.minLength).toBe(false);
  });
});
