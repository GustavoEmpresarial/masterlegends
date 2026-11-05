import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { runWithSystemContext } from '../../src/common/lib/prisma-context.js';
import { isIntegrationEnabled } from '../helpers/integration-env.js';
import { buildTestApp } from '../helpers/test-app.js';
import { flushRedis, truncateAuthTables } from '../helpers/teardown.js';
import { registerVerifyAndLogin } from '../helpers/register-and-login.js';
import {
  createTestQuest,
  createTestQuestProgress,
  truncateEventTables,
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

run('events claim integration', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    await truncateEventTables(app.prisma);
    await truncateAuthTables(app.prisma);
    await flushRedis(app.redis);
  });

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/events/quests/11111111-1111-4111-8111-111111111111/claim',
    });
    expect(res.statusCode).toBe(401);
  });

  it('claims once then rejects double claim with 409', async () => {
    const token = await registerVerifyAndLogin(app, {
      email: 'events.claim@gmail.com',
      username: 'evtclaim1',
    });
    const userId = await userIdByEmail(app.prisma, 'events.claim@gmail.com');

    const quest = await createTestQuest(app.prisma, {
      title: 'Claim me',
      target: 1,
      rewards: [{ type: 'gmt', amount: 5 }],
      maxClaimsPerUser: 1,
    });
    await createTestQuestProgress(app.prisma, {
      userId,
      questId: quest.id,
      count: 1,
      target: 1,
    });

    const first = await app.inject({
      method: 'POST',
      url: `/api/events/quests/${quest.id}/claim`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().ok).toBe(true);

    const second = await app.inject({
      method: 'POST',
      url: `/api/events/quests/${quest.id}/claim`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toMatch(/QUEST_CLAIM_CAP|QUEST_ALREADY_CLAIMED/);
  });

  it('rejects when global claim cap is exhausted', async () => {
    const tokenA = await registerVerifyAndLogin(app, {
      email: 'events.cap.a@gmail.com',
      username: 'evtcapa',
    });
    const tokenB = await registerVerifyAndLogin(app, {
      email: 'events.cap.b@gmail.com',
      username: 'evtcapb',
    });
    const userA = await userIdByEmail(app.prisma, 'events.cap.a@gmail.com');
    const userB = await userIdByEmail(app.prisma, 'events.cap.b@gmail.com');

    const quest = await createTestQuest(app.prisma, {
      title: 'Global cap',
      target: 1,
      rewards: [{ type: 'overwall', amount: 10 }],
      maxClaimsPerUser: 1,
      maxGlobalClaims: 1,
    });
    await createTestQuestProgress(app.prisma, {
      userId: userA,
      questId: quest.id,
      count: 1,
      target: 1,
    });
    await createTestQuestProgress(app.prisma, {
      userId: userB,
      questId: quest.id,
      count: 1,
      target: 1,
    });

    const first = await app.inject({
      method: 'POST',
      url: `/api/events/quests/${quest.id}/claim`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(first.statusCode).toBe(200);

    const blocked = await app.inject({
      method: 'POST',
      url: `/api/events/quests/${quest.id}/claim`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe('QUEST_CLAIM_CAP');
  });
});
