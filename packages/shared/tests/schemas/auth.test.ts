import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../../src/schemas/auth.js';
import { VALID_TEST_PASSWORD } from '../../src/schemas/password.js';

describe('auth schemas', () => {
  it('accepts valid register input', () => {
    expect(
      registerSchema.safeParse({
        email: 'alice@gmail.com',
        password: VALID_TEST_PASSWORD,
        username: 'alice_1',
        acceptTerms: true,
        turnstileToken: 'token-abc',
      }).success,
    ).toBe(true);
  });

  it('rejects register without acceptTerms', () => {
    expect(
      registerSchema.safeParse({
        email: 'a@b.com',
        password: VALID_TEST_PASSWORD,
        username: 'alice_1',
      }).success,
    ).toBe(false);
  });

  it('rejects weak password on register', () => {
    expect(
      registerSchema.safeParse({
        email: 'a@b.com',
        password: 'short',
        username: 'alice',
        acceptTerms: true,
      }).success,
    ).toBe(false);
  });

  it('rejects password without security requirements', () => {
    expect(
      registerSchema.safeParse({
        email: 'a@b.com',
        password: 'password1',
        username: 'alice_1',
        acceptTerms: true,
      }).success,
    ).toBe(false);
  });

  it('accepts login with optional turnstileToken', () => {
    expect(
      loginSchema.safeParse({ email: 'a@b.com', password: 'x', turnstileToken: 'tok' }).success,
    ).toBe(true);
  });

  it('accepts login without turnstileToken', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });

  it('accepts forgot password email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });

  it('rejects short reset token', () => {
    expect(
      resetPasswordSchema.safeParse({ token: 'short', newPassword: VALID_TEST_PASSWORD }).success,
    ).toBe(false);
  });

  it('accepts valid reset password', () => {
    expect(
      resetPasswordSchema.safeParse({
        token: 'a'.repeat(32),
        newPassword: VALID_TEST_PASSWORD,
      }).success,
    ).toBe(true);
  });

  it('accepts verify email token', () => {
    expect(
      verifyEmailSchema.safeParse({ token: 'a'.repeat(32) }).success,
    ).toBe(true);
  });
});
