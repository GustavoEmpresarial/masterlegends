import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('verifyTurnstileToken', () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.TURNSTILE_SECRET_KEY;
    } else {
      process.env.TURNSTILE_SECRET_KEY = originalSecret;
    }
    vi.unstubAllGlobals();
    vi.doUnmock('../../../src/config/env.js');
  });

  it('skips verification when secret is not configured', async () => {
    vi.doMock('../../../src/config/env.js', () => ({ config: { TURNSTILE_SECRET_KEY: '' } }));
    const { verifyTurnstileToken } = await import('../../../src/common/lib/turnstile.js');
    await expect(verifyTurnstileToken(undefined)).resolves.toBe(true);
  });

  it('rejects missing token when secret is configured', async () => {
    vi.doMock('../../../src/config/env.js', () => ({ config: { TURNSTILE_SECRET_KEY: 'test-secret' } }));
    const { verifyTurnstileToken } = await import('../../../src/common/lib/turnstile.js');
    await expect(verifyTurnstileToken(undefined)).resolves.toBe(false);
  });

  it('accepts valid token from Cloudflare', async () => {
    vi.doMock('../../../src/config/env.js', () => ({ config: { TURNSTILE_SECRET_KEY: 'test-secret' } }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }),
    );
    const { verifyTurnstileToken } = await import('../../../src/common/lib/turnstile.js');
    await expect(verifyTurnstileToken('valid-token', '127.0.0.1')).resolves.toBe(true);
  });

  it('rejects invalid token from Cloudflare', async () => {
    vi.doMock('../../../src/config/env.js', () => ({ config: { TURNSTILE_SECRET_KEY: 'test-secret' } }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
      }),
    );
    const { verifyTurnstileToken } = await import('../../../src/common/lib/turnstile.js');
    await expect(verifyTurnstileToken('bad-token')).resolves.toBe(false);
  });
});
