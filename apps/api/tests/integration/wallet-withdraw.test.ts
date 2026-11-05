import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { isIntegrationEnabled } from '../helpers/integration-env.js';
import { buildTestApp } from '../helpers/test-app.js';
import { flushRedis, truncateAuthTables } from '../helpers/teardown.js';
import { registerVerifyAndLogin } from '../helpers/register-and-login.js';
import { setGmtBalance } from '../factories/index.js';
import { runWithSystemContext } from '../../src/common/lib/prisma-context.js';

const run = isIntegrationEnabled() ? describe : describe.skip;

run('wallet withdraw integration', () => {
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

  it('lists empty withdraw requests and rejects insufficient USDC', async () => {
    const email = 'wallet.withdraw@gmail.com';
    const token = await registerVerifyAndLogin(app, {
      email,
      username: 'wduser1',
    });
    const userId = await runWithSystemContext(async () => {
      const u = await app.prisma.user.findUniqueOrThrow({ where: { email } });
      return u.id;
    });

    await app.inject({
      method: 'POST',
      url: '/api/club/create',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'FC Withdraw' },
    });

    // GMT only — withdraw needs USDC
    await setGmtBalance(app.prisma, userId, 1000);

    const list = await app.inject({
      method: 'GET',
      url: '/api/wallet/withdraw-requests',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.json().requests ?? list.json())).toBe(true);

    const create = await app.inject({
      method: 'POST',
      url: '/api/wallet/withdraw-requests',
      headers: { authorization: `Bearer ${token}` },
      payload: { amountUsdc: 50 },
    });
    expect([400, 403]).toContain(create.statusCode);
    expect(create.json().error?.code).toBeTruthy();
  });

  it('rejects invalid withdraw amount', async () => {
    const token = await registerVerifyAndLogin(app, {
      email: 'wallet.wd.bad@gmail.com',
      username: 'wdbad1',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/wallet/withdraw-requests',
      headers: { authorization: `Bearer ${token}` },
      payload: { amountUsdc: -1 },
    });
    expect([400, 422]).toContain(res.statusCode);
  });
});
