import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { isIntegrationEnabled } from '../helpers/integration-env.js';
import { buildTestApp } from '../helpers/test-app.js';
import { flushRedis, truncateAuthTables } from '../helpers/teardown.js';
import { registerVerifyAndLogin } from '../helpers/register-and-login.js';

const run = isIntegrationEnabled() ? describe : describe.skip;

run('marketplace buy integration', () => {
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

  it('search works and buy rejects missing listing', async () => {
    const token = await registerVerifyAndLogin(app, {
      email: 'market.buy@gmail.com',
      username: 'mktbuy1',
    });

    await app.inject({
      method: 'POST',
      url: '/api/club/create',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'FC Market Buy' },
    });

    const search = await app.inject({
      method: 'GET',
      url: '/api/marketplace/search',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(search.statusCode).toBe(200);
    expect(Array.isArray(search.json().listings)).toBe(true);

    const buy = await app.inject({
      method: 'POST',
      url: '/api/marketplace/buy/11111111-1111-4111-8111-111111111111',
      headers: { authorization: `Bearer ${token}` },
    });
    expect([400, 404]).toContain(buy.statusCode);
    expect(buy.json().error?.code).toBeTruthy();
  });

  it('rejects invalid listing id', async () => {
    const token = await registerVerifyAndLogin(app, {
      email: 'market.bad@gmail.com',
      username: 'mktbad1',
    });
    const buy = await app.inject({
      method: 'POST',
      url: '/api/marketplace/buy/not-a-uuid',
      headers: { authorization: `Bearer ${token}` },
    });
    expect([400, 422]).toContain(buy.statusCode);
  });
});

