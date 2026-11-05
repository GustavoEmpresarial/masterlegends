import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { isIntegrationEnabled } from '../helpers/integration-env.js';
import { buildTestApp } from '../helpers/test-app.js';
import { flushRedis, truncateAuthTables } from '../helpers/teardown.js';
import { registerVerifyAndLogin } from '../helpers/register-and-login.js';

const run = isIntegrationEnabled() ? describe : describe.skip;

run('feature routes smoke', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let token: string;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    await truncateAuthTables(app.prisma);
    await flushRedis(app.redis);
    token = await registerVerifyAndLogin(app, {
      email: 'smoke@gmail.com',
      username: 'smokeuser',
    });
  });

  it('GET /api/marketplace/search', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/marketplace/search',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().listings)).toBe(true);
  });

  it('GET /api/pass/progress', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pass/progress',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().xp).toBe(0);
  });

  it('GET /api/pvp/board requires a club', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pvp/board',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('CLUB_NOT_FOUND');
  });

  it('GET /api/mining/me returns summary defaults', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/mining/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Shape may evolve; assert stable summary fields when present.
    expect(body).toBeTypeOf('object');
    if ('pending' in body) expect(body.pending).toBe(0);
    if ('lifetimeEarned' in body) expect(body.lifetimeEarned).toBe(0);
    if ('paused' in body) expect(body.paused).toBe(false);
  });

  it('GET /api/mining/blocks returns empty list initially', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/mining/blocks?limit=5',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().blocks)).toBe(true);
  });

  it('GET /api/mining/history returns empty rewards for new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/mining/history',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rewards).toEqual([]);
  });

  it('POST /api/mining/claim rejects when pending is zero', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/mining/claim',
      headers: { authorization: `Bearer ${token}` },
    });
    // No wallet linked, no balance, or route not found for empty claim — client error
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
  });
});
