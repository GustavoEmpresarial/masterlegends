import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

/** Example password that satisfies all rules (tests). */
export const VALID_TEST_PASSWORD = 'Test1!pass';

export type PasswordRuleKey =
  | 'minLength'
  | 'uppercase'
  | 'lowercase'
  | 'number'
  | 'special';

export type PasswordRuleStatus = Record<PasswordRuleKey, boolean>;

export function checkPasswordStrength(password: string): PasswordRuleStatus {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function isPasswordStrong(password: string): boolean {
  return Object.values(checkPasswordStrength(password)).every(Boolean);
}

export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(128)
  .refine(isPasswordStrong, { message: 'PASSWORD_WEAK' });
