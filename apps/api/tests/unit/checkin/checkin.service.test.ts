import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { CheckInService } from '../../../src/modules/checkin/checkin.service.js';
import { ErrorCode } from '../../../src/common/lib/errors.js';
import { CHECKIN_OVERWALL_AMOUNT } from '@mll/shared';

function makePrisma() {
  const grants: Array<{
    id: string;
    userId: string;
    amount: number;
    checkInDay: Date;
    grantedAt: Date;
    expiresAt: Date;
  }> = [];

  return {
    checkInGrant: {
      findMany: vi.fn(async ({ where }: { where: { userId?: string; expiresAt?: { gt: Date } } }) => {
        const now = where.expiresAt?.gt ?? new Date();
        return grants.filter(
          (g) =>
            (!where.userId || g.userId === where.userId) &&
            g.expiresAt > now,
        );
      }),
      aggregate: vi.fn(async ({ where }: { where: { userId: string; expiresAt: { gt: Date } } }) => {
        const now = where.expiresAt.gt;
        const sum = grants
          .filter((g) => g.userId === where.userId && g.expiresAt > now)
          .reduce((acc, g) => acc + g.amount, 0);
        return { _sum: { amount: sum || null } };
      }),
      findFirst: vi.fn(async ({ where, orderBy }: { where: { userId: string }; orderBy: { checkInDay: 'desc' } }) => {
        const userGrants = grants
          .filter((g) => g.userId === where.userId)
          .sort((a, b) => b.checkInDay.getTime() - a.checkInDay.getTime());
        return userGrants[0] ?? null;
      }),
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { userId_checkInDay: { userId: string; checkInDay: Date } };
        }) => {
          const { userId, checkInDay } = where.userId_checkInDay;
          return (
            grants.find(
              (g) => g.userId === userId && g.checkInDay.getTime() === checkInDay.getTime(),
            ) ?? null
          );
        },
      ),
      create: vi.fn(async ({ data }: { data: typeof grants[0] }) => {
        const row = {
          id: `grant-${grants.length + 1}`,
          grantedAt: new Date(),
          ...data,
        };
        grants.push(row);
        return row;
      }),
    },
    eventOverwallGrant: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    club: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    platformConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    __grants: grants,
  } as any;
}

describe('CheckInService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-07T15:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('claim creates a 1 OW grant expiring in 7 days', async () => {
    const prisma = makePrisma();
    const service = new CheckInService(prisma);

    const result = await service.claim('user-1');

    expect(result.grant.amount).toBe(CHECKIN_OVERWALL_AMOUNT);
    expect(result.activeOverwall).toBe(1);
    expect(new Date(result.grant.expiresAt).getUTCDate()).toBe(14);
  });

  it('rejects duplicate claim on same UTC day', async () => {
    const prisma = makePrisma();
    const service = new CheckInService(prisma);

    await service.claim('user-1');

    await expect(service.claim('user-1')).rejects.toMatchObject({
      code: ErrorCode.CHECKIN_ALREADY_CLAIMED,
    });
  });

  it('keeps canClaimToday=false and streak intact hours after a morning claim (same UTC day)', async () => {
    // 08:00 BRT (UTC-3) == 11:00 UTC — user claims in the morning, local time.
    vi.setSystemTime(new Date('2026-07-07T11:00:00.000Z'));
    const prisma = makePrisma();
    const service = new CheckInService(prisma);

    const claimResult = await service.claim('user-1');
    expect(claimResult.streak).toBe(1);

    // Still the same UTC calendar day, just later — e.g. checking the app again at night.
    vi.setSystemTime(new Date('2026-07-07T23:30:00.000Z'));
    const status = await service.getStatus('user-1');

    expect(status.canClaimToday).toBe(false);
    expect(status.streak).toBe(1);
  });

  it('getStatus reports stacked active overwall', async () => {
    const prisma = makePrisma();
    prisma.__grants.push(
      {
        id: 'g1',
        userId: 'user-1',
        amount: 1,
        checkInDay: new Date('2026-07-05T00:00:00.000Z'),
        grantedAt: new Date('2026-07-05T00:00:00.000Z'),
        expiresAt: new Date('2026-07-12T00:00:00.000Z'),
      },
      {
        id: 'g2',
        userId: 'user-1',
        amount: 1,
        checkInDay: new Date('2026-07-06T00:00:00.000Z'),
        grantedAt: new Date('2026-07-06T00:00:00.000Z'),
        expiresAt: new Date('2026-07-13T00:00:00.000Z'),
      },
    );

    const service = new CheckInService(prisma);
    const status = await service.getStatus('user-1');

    expect(status.activeOverwall).toBe(2);
    expect(status.canClaimToday).toBe(true);
    expect(status.grants).toHaveLength(2);
  });

  it('maps P2002 duplicate grant to CHECKIN_ALREADY_CLAIMED', async () => {
    const dup = Object.assign(new Error('dup'), { code: 'P2002', clientVersion: '5' });
    Object.setPrototypeOf(dup, Prisma.PrismaClientKnownRequestError.prototype);

    const prisma = makePrisma();
    prisma.checkInGrant.create = vi.fn().mockRejectedValue(dup);

    const service = new CheckInService(prisma);
    await expect(service.claim('user-1')).rejects.toMatchObject({
      code: ErrorCode.CHECKIN_ALREADY_CLAIMED,
    });
  });
});
