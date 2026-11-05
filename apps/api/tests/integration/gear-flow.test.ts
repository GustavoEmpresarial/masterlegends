import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { runWithSystemContext } from '../../src/common/lib/prisma-context.js';
import { isIntegrationEnabled } from '../helpers/integration-env.js';
import { buildTestApp } from '../helpers/test-app.js';
import { flushRedis, truncateAuthTables } from '../helpers/teardown.js';
import { registerVerifyAndLogin } from '../helpers/register-and-login.js';
import {
  createTestBasePlayer,
  createTestGearCatalog,
  setGmtBalance,
  truncateGearTables,
} from '../factories/index.js';

const run = isIntegrationEnabled() ? describe : describe.skip;

async function userIdByEmail(
  prisma: Awaited<ReturnType<typeof buildTestApp>>['prisma'],
  email: string,
): Promise<string> {
  return runWithSystemContext(async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    return u.id;
  });
}

run('gear flow integration', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    await truncateGearTables(app.prisma);
    await truncateAuthTables(app.prisma);
    await flushRedis(app.redis);
  });

  it('returns 401 without token on gear routes', async () => {
    const bag = await app.inject({ method: 'GET', url: '/api/club/gear' });
    expect(bag.statusCode).toBe(401);

    const buy = await app.inject({
      method: 'POST',
      url: '/api/stadium/shop/buy-gear',
      payload: { catalogItemId: '11111111-1111-4111-8111-111111111111' },
    });
    expect(buy.statusCode).toBe(401);
  });

  it('buy → bag → equip → inventory effectiveOverwall', async () => {
    const email = 'gear.flow@gmail.com';
    const token = await registerVerifyAndLogin(app, {
      email,
      username: 'gearflow1',
    });
    const userId = await userIdByEmail(app.prisma, email);

    const club = await app.inject({
      method: 'POST',
      url: '/api/club/create',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'FC Gear Flow' },
    });
    expect(club.statusCode).toBe(200);

    await setGmtBalance(app.prisma, userId, 500);
    const catalog = await createTestGearCatalog(app.prisma, {
      slug: `boots-flow-${Date.now()}`,
      owBonus: 30,
      priceGmt: 40,
    });
    const player = await createTestBasePlayer(app.prisma, userId, {
      overwall: 100,
      name: 'Boot Wearer',
    });

    const buy = await app.inject({
      method: 'POST',
      url: '/api/stadium/shop/buy-gear',
      headers: { authorization: `Bearer ${token}` },
      payload: { catalogItemId: catalog.id },
    });
    if (buy.statusCode !== 200) {
      throw new Error(`buy-gear failed: ${buy.statusCode} ${buy.body}`);
    }
    const bought = buy.json();
    expect(bought.pricePaid).toBe(40);
    expect(bought.item.id).toBeTruthy();

    const bag = await app.inject({
      method: 'GET',
      url: '/api/club/gear',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(bag.statusCode).toBe(200);
    expect(bag.json().total).toBe(1);

    const equip = await app.inject({
      method: 'POST',
      url: '/api/club/gear/equip',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        userGearId: bought.item.id,
        playerId: player.id,
        kind: 'base',
      },
    });
    expect(equip.statusCode).toBe(200);
    expect(equip.json().items[0].equippedOn.playerId).toBe(player.id);

    const inv = await app.inject({
      method: 'GET',
      url: '/api/club/inventory',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(inv.statusCode).toBe(200);
    const row = inv.json().players.find((p: { id: string }) => p.id === player.id);
    expect(row).toBeTruthy();
    expect(row.effectiveOverwall).toBe(130);
    expect(row.overwall).toBe(100);
  });
});
