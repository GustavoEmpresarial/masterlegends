import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { ErrorCode, QuestPeriod } from '@mll/shared';
import { QuestClaimService } from '../../../src/modules/events/quest-claim.service.js';
import { AppError } from '../../../src/common/lib/errors.js';

vi.mock('../../../src/modules/events/reward-grant.service.js', () => ({
  grantQuestRewards: vi.fn(async () => [{ type: 'gmt', amount: 10 }]),
}));

import { grantQuestRewards } from '../../../src/modules/events/reward-grant.service.js';

const questId = '11111111-1111-4111-8111-111111111111';
const userId = 'user-1';

function baseQuest(overrides: Record<string, unknown> = {}) {
  return {
    id: questId,
    active: true,
    startsAt: new Date('2020-01-01T00:00:00.000Z'),
    endsAt: new Date('2030-01-01T00:00:00.000Z'),
    requireEmailVerified: true,
    period: QuestPeriod.NONE,
    maxClaimsPerUser: 1,
    maxGlobalClaims: null as number | null,
    target: 1,
    rewards: [{ type: 'gmt', amount: 10 }],
    campaign: null as null | {
      active: boolean;
      startsAt: Date;
      endsAt: Date;
    },
    ...overrides,
  };
}

function makePrisma(opts: {
  user?: { emailVerifiedAt: Date | null } | null;
  emailVerified?: boolean | null;
  quest?: ReturnType<typeof baseQuest> | null;
  userClaims?: number;
  globalClaims?: number;
  progressCount?: number | null;
  claimCreateError?: Error | null;
  grantError?: Error | null;
}) {
  const quest = opts.quest === undefined ? baseQuest() : opts.quest;
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    questDefinition: {
      findUnique: vi.fn().mockResolvedValue(quest),
    },
    questClaim: {
      count: vi.fn(async ({ where }: { where: { userId?: string; questId: string } }) => {
        if (where.userId) return opts.userClaims ?? 0;
        return opts.globalClaims ?? 0;
      }),
      create: vi.fn(async () => {
        if (opts.claimCreateError) throw opts.claimCreateError;
        return { id: 'claim-1' };
      }),
    },
    questProgress: {
      findUnique: vi.fn().mockResolvedValue(
        opts.progressCount === undefined
          ? { count: 1, target: quest?.target ?? 1 }
          : opts.progressCount == null
            ? null
            : { count: opts.progressCount, target: quest?.target ?? 1 },
      ),
    },
    questClaimLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  };

  const userResolved =
    opts.user !== undefined
      ? opts.user
      : opts.emailVerified === undefined
        ? { emailVerifiedAt: new Date() }
        : { emailVerifiedAt: opts.emailVerified };

  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(userResolved),
    },
    platformConfig: {
      findUnique: vi.fn().mockResolvedValue({ specialStaminaCost: 0 }),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    __tx: tx,
  } as any;
}

describe('QuestClaimService', () => {
  beforeEach(() => {
    vi.mocked(grantQuestRewards).mockClear();
    vi.mocked(grantQuestRewards).mockResolvedValue([{ type: 'gmt', amount: 10 }]);
  });

  it('claims when progress ready and grants rewards inside tx', async () => {
    const prisma = makePrisma({
      progressCount: 1,
      quest: baseQuest({
        campaign: {
          active: true,
          startsAt: new Date('2020-01-01T00:00:00.000Z'),
          endsAt: new Date('2030-01-01T00:00:00.000Z'),
        },
        maxGlobalClaims: 10,
      }),
      globalClaims: 3,
    });
    const service = new QuestClaimService(prisma);
    const longIp = `1.2.3.${'9'.repeat(80)}`;
    const longUa = 'UA'.repeat(300);

    const result = await service.claim(userId, questId, { ip: longIp, userAgent: longUa });

    expect(result.ok).toBe(true);
    expect(result.periodKey).toBe('once');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });
    expect(prisma.__tx.questDefinition.findUnique).toHaveBeenCalledWith({
      where: { id: questId },
      include: { campaign: true },
    });
    expect(prisma.__tx.$executeRaw).toHaveBeenCalled();
    expect(grantQuestRewards).toHaveBeenCalled();
    expect(prisma.__tx.questClaimLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ip: longIp.slice(0, 64),
        userAgent: longUa.slice(0, 512),
      }),
    });
  });

  it('logs null ip/userAgent when meta fields are present but empty', async () => {
    const prisma = makePrisma({ progressCount: 1 });
    const service = new QuestClaimService(prisma);
    // meta exists but ip/userAgent undefined — optional chain before slice must hold.
    await expect(service.claim(userId, questId, {})).resolves.toMatchObject({ ok: true });
    expect(prisma.__tx.questClaimLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ip: null, userAgent: null }),
    });
  });

  it('rejects when user is missing', async () => {
    const prisma = makePrisma({ user: null, progressCount: 1 });
    const service = new QuestClaimService(prisma);
    await expect(service.claim(userId, questId)).rejects.toMatchObject({
      code: ErrorCode.USER_NOT_FOUND,
    });
  });

  it('rejects when quest is missing', async () => {
    const prisma = makePrisma({ quest: null, progressCount: 1 });
    const service = new QuestClaimService(prisma);
    await expect(service.claim(userId, questId)).rejects.toMatchObject({
      code: ErrorCode.QUEST_NOT_FOUND,
    });
  });

  it('rejects when quest window is closed', async () => {
    const prisma = makePrisma({
      progressCount: 1,
      quest: baseQuest({
        startsAt: new Date('2030-01-01T00:00:00.000Z'),
        endsAt: new Date('2031-01-01T00:00:00.000Z'),
      }),
    });
    const service = new QuestClaimService(prisma);
    await expect(service.claim(userId, questId)).rejects.toMatchObject({
      code: ErrorCode.QUEST_WINDOW_CLOSED,
    });
  });

  it('rejects when campaign is inactive', async () => {
    const prisma = makePrisma({
      progressCount: 1,
      quest: baseQuest({
        campaign: {
          active: false,
          startsAt: new Date('2020-01-01T00:00:00.000Z'),
          endsAt: new Date('2030-01-01T00:00:00.000Z'),
        },
      }),
    });
    const service = new QuestClaimService(prisma);
    await expect(service.claim(userId, questId)).rejects.toMatchObject({
      code: ErrorCode.QUEST_WINDOW_CLOSED,
    });
  });

  it('rejects when campaign window is closed', async () => {
    const prisma = makePrisma({
      progressCount: 1,
      quest: baseQuest({
        campaign: {
          active: true,
          startsAt: new Date('2010-01-01T00:00:00.000Z'),
          endsAt: new Date('2011-01-01T00:00:00.000Z'),
        },
      }),
    });
    const service = new QuestClaimService(prisma);
    await expect(service.claim(userId, questId)).rejects.toMatchObject({
      code: ErrorCode.QUEST_WINDOW_CLOSED,
    });
  });

  it('allows unverified email when quest does not require it', async () => {
    const prisma = makePrisma({
      emailVerified: null,
      progressCount: 1,
      quest: baseQuest({ requireEmailVerified: false }),
    });
    const service = new QuestClaimService(prisma);
    await expect(service.claim(userId, questId)).resolves.toMatchObject({ ok: true });
  });

  it('rejects when email not verified and quest requires it', async () => {
    const prisma = makePrisma({ emailVerified: null, progressCount: 1 });
    const service = new QuestClaimService(prisma);

    await expect(service.claim(userId, questId)).rejects.toMatchObject({
      code: ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
    });
  });

  it('rejects when user claim cap reached', async () => {
    const prisma = makePrisma({ progressCount: 1, userClaims: 1 });
    const service = new QuestClaimService(prisma);

    await expect(service.claim(userId, questId)).rejects.toMatchObject({
      code: ErrorCode.QUEST_CLAIM_CAP,
      details: { scope: 'user' },
    });
  });

  it('daily quest scopes user claim cap to current periodKey', async () => {
    const prisma = makePrisma({
      progressCount: 1,
      userClaims: 0,
      quest: baseQuest({ period: QuestPeriod.DAILY, maxClaimsPerUser: 1 }),
    });
    const service = new QuestClaimService(prisma);
    await expect(service.claim(userId, questId)).resolves.toMatchObject({ ok: true });
    expect(prisma.__tx.questClaim.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId,
        questId,
        periodKey: expect.any(String),
      }),
    });
  });

  it('achievement quest counts lifetime claims without periodKey filter', async () => {
    const prisma = makePrisma({
      progressCount: 1,
      userClaims: 0,
      quest: baseQuest({ period: QuestPeriod.NONE, maxClaimsPerUser: 1 }),
    });
    const service = new QuestClaimService(prisma);
    await service.claim(userId, questId);
    expect(prisma.__tx.questClaim.count).toHaveBeenCalledWith({
      where: { userId, questId },
    });
  });

  it('rejects when global claim cap reached', async () => {
    const prisma = makePrisma({
      progressCount: 1,
      globalClaims: 5,
      quest: baseQuest({ maxGlobalClaims: 5 }),
    });
    const service = new QuestClaimService(prisma);

    await expect(service.claim(userId, questId)).rejects.toMatchObject({
      code: ErrorCode.QUEST_CLAIM_CAP,
      details: { scope: 'global' },
    });
  });

  it('skips global cap check when maxGlobalClaims is null', async () => {
    const prisma = makePrisma({
      progressCount: 1,
      globalClaims: 999,
      quest: baseQuest({ maxGlobalClaims: null }),
    });
    const service = new QuestClaimService(prisma);
    await expect(service.claim(userId, questId)).resolves.toMatchObject({ ok: true });
  });

  it('rejects when progress row is missing', async () => {
    const prisma = makePrisma({ progressCount: null });
    const service = new QuestClaimService(prisma);

    await expect(service.claim(userId, questId)).rejects.toMatchObject({
      code: ErrorCode.QUEST_NOT_READY,
      details: { count: 0, target: 1 },
    });
  });

  it('rejects when progress not ready', async () => {
    const prisma = makePrisma({ progressCount: 0 });
    const service = new QuestClaimService(prisma);

    await expect(service.claim(userId, questId)).rejects.toMatchObject({
      code: ErrorCode.QUEST_NOT_READY,
    });
  });

  it('maps P2002 unique violation to QUEST_ALREADY_CLAIMED', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const prisma = makePrisma({ progressCount: 1, claimCreateError: p2002 });
    const service = new QuestClaimService(prisma);

    await expect(service.claim(userId, questId)).rejects.toMatchObject({
      code: ErrorCode.QUEST_ALREADY_CLAIMED,
    });
  });

  it('rethrows non-P2002 Prisma errors', async () => {
    const p2003 = new Prisma.PrismaClientKnownRequestError('fk', {
      code: 'P2003',
      clientVersion: 'test',
    });
    const prisma = makePrisma({ progressCount: 1, claimCreateError: p2003 });
    const service = new QuestClaimService(prisma);

    await expect(service.claim(userId, questId)).rejects.toBe(p2003);
  });

  it('does not treat plain errors with code P2002 as already claimed', async () => {
    const fake = Object.assign(new Error('not prisma'), { code: 'P2002' });
    const prisma = makePrisma({ progressCount: 1, claimCreateError: fake });
    const service = new QuestClaimService(prisma);

    await expect(service.claim(userId, questId)).rejects.toBe(fake);
  });

  it('rethrows unexpected non-AppError failures', async () => {
    const boom = new Error('ledger down');
    vi.mocked(grantQuestRewards).mockRejectedValueOnce(boom);
    const prisma = makePrisma({ progressCount: 1 });
    const service = new QuestClaimService(prisma);

    await expect(service.claim(userId, questId)).rejects.toBe(boom);
  });

  it('rejects inactive quest', async () => {
    const prisma = makePrisma({
      progressCount: 1,
      quest: baseQuest({ active: false }),
    });
    const service = new QuestClaimService(prisma);

    await expect(service.claim(userId, questId)).rejects.toMatchObject({
      code: ErrorCode.QUEST_INACTIVE,
    });
  });

  it('stores null ip/userAgent when meta omitted', async () => {
    const prisma = makePrisma({ progressCount: 1 });
    const service = new QuestClaimService(prisma);
    await service.claim(userId, questId);
    expect(prisma.__tx.questClaimLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ip: null, userAgent: null }),
    });
  });

  it('propagates AppError without remapping', async () => {
    const prisma = makePrisma({ progressCount: 1, quest: baseQuest({ active: false }) });
    const service = new QuestClaimService(prisma);
    const err = await service.claim(userId, questId).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe(ErrorCode.QUEST_INACTIVE);
  });
});
