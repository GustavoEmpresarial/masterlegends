import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { isIntegrationEnabled } from '../helpers/integration-env.js';
import { buildTestApp } from '../helpers/test-app.js';
import { flushRedis, truncateAuthTables } from '../helpers/teardown.js';
import { runWithSystemContext } from '../../src/common/lib/prisma-context.js';
import { registerVerifyAndLogin } from '../helpers/register-and-login.js';

const run = isIntegrationEnabled() ? describe : describe.skip;

function cookiePair(setCookie: string | string[] | undefined, name: string): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const hit = list.find((c) => c.startsWith(`${name}=`));
  return hit?.split(';')[0] ?? '';
}

run('auth routes integration', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let redisQueue: Redis;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
    redisQueue = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
  });

  afterAll(async () => {
    if (redisQueue) await redisQueue.quit();
    if (app) await app.close();
  });

  beforeEach(async () => {
    await truncateAuthTables(app.prisma);
    await flushRedis(app.redis);
    await flushRedis(redisQueue);
  });

  it('registers user without session and enqueues email job', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'new.user@gmail.com',
        username: 'newuser1',
        password: 'Test.1!pass',
        acceptTerms: true,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().ok).toBe(true);
    expect(res.json().accessToken).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();

    const emailQueue = new Queue('email', { connection: redisQueue });
    const waiting = await emailQueue.getWaitingCount();
    expect(waiting).toBeGreaterThanOrEqual(1);
    await emailQueue.close();
  });

  it('login fails with invalid credentials', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'u@gmail.com', username: 'userone', password: 'Test.1!pass', acceptTerms: true },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'u@gmail.com', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('login blocked until email verified', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'pending@gmail.com',
        username: 'pending1',
        password: 'Test.1!pass',
        acceptTerms: true,
      },
    });
    const blocked = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'pending@gmail.com', password: 'Test.1!pass' },
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error.code).toBe('AUTH_EMAIL_NOT_VERIFIED');

    await runWithSystemContext(async () => {
      await app.prisma.user.update({
        where: { email: 'pending@gmail.com' },
        data: { emailVerifiedAt: new Date() },
      });
    });

    const ok = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'pending@gmail.com', password: 'Test.1!pass' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().accessToken).toBeTruthy();
  });

  it('rotates refresh token and detects reuse', async () => {
    await registerVerifyAndLogin(app, { email: 'rot@gmail.com', username: 'rotuser' });
    // Fresh login for a clean refresh cookie family
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'rot@gmail.com', password: 'Test.1!pass' },
    });
    const refreshCookie = cookiePair(login.headers['set-cookie'], 'refresh_token');
    const csrfRes = await app.inject({ method: 'GET', url: '/auth/csrf' });
    const csrfToken = csrfRes.json().csrfToken as string;
    const csrfCookie = cookiePair(csrfRes.headers['set-cookie'], '_csrf');

    const first = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: `${refreshCookie}; ${csrfCookie}`,
        'x-csrf-token': csrfToken,
      },
    });
    expect(first.statusCode).toBe(200);

    const previousGrace = process.env.REFRESH_REUSE_GRACE_MS;
    process.env.REFRESH_REUSE_GRACE_MS = '0';
    const reuse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: `${refreshCookie}; ${csrfCookie}`,
        'x-csrf-token': csrfToken,
      },
    });
    if (previousGrace === undefined) delete process.env.REFRESH_REUSE_GRACE_MS;
    else process.env.REFRESH_REUSE_GRACE_MS = previousGrace;
    expect(reuse.statusCode).toBe(401);
    expect(reuse.json().error.code).toBe('AUTH_REFRESH_REUSED');
  });

  it('rejects refresh without CSRF', async () => {
    await registerVerifyAndLogin(app, { email: 'csrf@gmail.com', username: 'csrfuser' });
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'csrf@gmail.com', password: 'Test.1!pass' },
    });
    const refreshCookie = cookiePair(login.headers['set-cookie'], 'refresh_token');
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: refreshCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects refresh token used as Bearer on /auth/me', async () => {
    await registerVerifyAndLogin(app, { email: 'bearer@gmail.com', username: 'beareruser' });
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'bearer@gmail.com', password: 'Test.1!pass' },
    });
    const refreshCookie = cookiePair(login.headers['set-cookie'], 'refresh_token');
    const refreshToken = refreshCookie.replace('refresh_token=', '');

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_INVALID_TOKEN_TYPE');
  });

  it('rejects login when turnstile verification fails', async () => {
    const original = process.env.TURNSTILE_SECRET_KEY;
    const originalOptIn = process.env.TURNSTILE_IN_TESTS;
    process.env.TURNSTILE_IN_TESTS = 'true';
    process.env.TURNSTILE_SECRET_KEY = 'test-turnstile-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
      }),
    );

    vi.resetModules();
    const { buildApp } = await import('../../src/app.js');
    const turnstileApp = await buildApp();
    await turnstileApp.listen({ port: 0, host: '127.0.0.1' });

    try {
      const res = await turnstileApp.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'any@gmail.com',
          password: 'Test.1!pass',
          turnstileToken: 'bad-token',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('AUTH_CAPTCHA_INVALID');
    } finally {
      await turnstileApp.close();
      if (original === undefined) {
        delete process.env.TURNSTILE_SECRET_KEY;
      } else {
        process.env.TURNSTILE_SECRET_KEY = original;
      }
      if (originalOptIn === undefined) {
        delete process.env.TURNSTILE_IN_TESTS;
      } else {
        process.env.TURNSTILE_IN_TESTS = originalOptIn;
      }
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });

  it('verifies email token', async () => {
    await runWithSystemContext(async () => {
      const user = await app.prisma.user.create({
        data: {
          email: 'verify@gmail.com',
          username: 'verifyuser',
          password: 'hash',
          referralCode: 'VERIFY01',
        },
      });
      const plain = 'b'.repeat(64);
      const { hashToken } = await import('../../src/modules/auth/tokens/hash.js');
      await app.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(plain),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { token: plain },
      });
      expect(res.statusCode).toBe(200);
      const updated = await app.prisma.user.findUnique({ where: { id: user.id } });
      expect(updated?.emailVerifiedAt).toBeTruthy();
    });
  });
});
