import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { isIntegrationEnabled } from '../helpers/integration-env.js';
import { buildTestApp } from '../helpers/test-app.js';
import { flushRedis, truncateAuthTables } from '../helpers/teardown.js';
import { registerVerifyAndLogin } from '../helpers/register-and-login.js';

const run = isIntegrationEnabled() ? describe : describe.skip;

run('club routes integration', () => {
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

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/club/' });
    expect(res.statusCode).toBe(401);
  });

  it('creates and fetches club', async () => {
    const token = await registerVerifyAndLogin(app, {
      email: 'club@gmail.com',
      username: 'clubuser',
    });

    const create = await app.inject({
      method: 'POST',
      url: '/api/club/create',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'FC Integration' },
    });
    expect(create.statusCode).toBe(200);

    const get = await app.inject({
      method: 'GET',
      url: '/api/club/',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(200);
    expect(get.json().name).toBe('FC Integration');
  });
});
