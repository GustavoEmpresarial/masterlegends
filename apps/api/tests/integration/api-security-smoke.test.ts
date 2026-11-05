import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { isIntegrationEnabled } from '../helpers/integration-env.js';
import { buildTestApp } from '../helpers/test-app.js';
import { flushRedis, truncateAuthTables } from '../helpers/teardown.js';
import { registerVerifyAndLogin } from '../helpers/register-and-login.js';

const run = isIntegrationEnabled() ? describe : describe.skip;

run('API security smoke', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

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
  });

  it('rejects invalid JWT on critical player routes', async () => {
    const routes = [
      { method: 'GET' as const, url: '/api/events/' },
      { method: 'GET' as const, url: '/api/club/gear' },
      { method: 'GET' as const, url: '/api/marketplace/search' },
      { method: 'GET' as const, url: '/api/wallet/summary' },
    ];

    for (const r of routes) {
      const res = await app.inject({
        ...r,
        headers: { authorization: 'Bearer totally.invalid.token' },
      });
      expect(res.statusCode, `${r.method} ${r.url}`).toBe(401);
    }
  });

  it('rejects unauthenticated admin API', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/api/users' });
    expect([401, 403]).toContain(res.statusCode);
  });

  it('authenticated player cannot call admin users list', async () => {
    const token = await registerVerifyAndLogin(app, {
      email: 'player.security@gmail.com',
      username: 'secplayer1',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/users',
      headers: { authorization: `Bearer ${token}` },
    });
    expect([401, 403]).toContain(res.statusCode);
  });
});
