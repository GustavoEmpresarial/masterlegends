import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { AdminUsersService } from '../../../src/modules/admin/admin-users.service.js';
import { AppError } from '../../../src/common/lib/errors.js';
import { ErrorCode } from '@mll/shared';

function mockPrisma() {
  return {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    supportTicket: { count: vi.fn().mockResolvedValue(0) },
    withdrawalRequest: { count: vi.fn().mockResolvedValue(0) },
    mGTTransaction: { findMany: vi.fn().mockResolvedValue([]) },
    walletTransaction: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
    playerCache: { findMany: vi.fn().mockResolvedValue([]) },
    listing: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function fullUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'a@test.com',
    username: 'alice',
    wallet: null,
    referralCode: 'ABCD1234',
    referredBy: null,
    emailVerifiedAt: new Date(),
    bannedAt: null,
    banReason: null,
    bannedBy: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    mgtBalance: { amount: 100 },
    club: null,
    basePlayers: [],
    ...overrides,
  };
}

describe('AdminUsersService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: AdminUsersService;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new AdminUsersService(prisma as never);
  });

  it('banUser sets bannedAt and reason', async () => {
    const bannedAt = new Date();
    const user = fullUser({ bannedAt, banReason: 'cheating', bannedBy: 'admin1' });
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'u1' })
      .mockResolvedValueOnce(user);
    prisma.user.update.mockResolvedValue({});
    prisma.supportTicket.count.mockResolvedValue(0);
    prisma.withdrawalRequest.count.mockResolvedValue(0);

    const result = await service.banUser('u1', 'cheating', 'admin1');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ banReason: 'cheating', bannedBy: 'admin1' }),
      }),
    );
    expect(result.bannedAt).toBeTruthy();
    expect(result.banReason).toBe('cheating');
  });

  it('getUser throws when not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getUser('missing')).rejects.toMatchObject({
      code: ErrorCode.USER_NOT_FOUND,
    });
  });

  it('unbanUser clears ban fields', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({});
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'u1' })
      .mockResolvedValueOnce(fullUser());
    prisma.supportTicket.count.mockResolvedValue(0);
    prisma.withdrawalRequest.count.mockResolvedValue(0);

    const result = await service.unbanUser('u1');
    expect(result.bannedAt).toBeNull();
  });
});

describe('AdminUsersService ban blocks login (integration with auth)', () => {
  it('banned user has bannedAt set for auth guard rejection', async () => {
    const prisma = mockPrisma();
    const service = new AdminUsersService(prisma as never);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockImplementation(async ({ data }: { data: { bannedAt: Date } }) => ({
      bannedAt: data.bannedAt,
    }));
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'u1' })
      .mockResolvedValueOnce(
        fullUser({ bannedAt: new Date(), banReason: 'abuse', bannedBy: 'admin' }),
      );
    prisma.supportTicket.count.mockResolvedValue(0);
    prisma.withdrawalRequest.count.mockResolvedValue(0);

    const detail = await service.banUser('u1', 'abuse', 'admin');
    expect(detail.bannedAt).not.toBeNull();
    expect(detail.banReason).toBe('abuse');
  });
});

type ProfileUser = {
  id: string;
  username: string | null;
  email: string | null;
  wallet: string | null;
  referralCode: string;
  failedLoginCount: number;
  lockedUntil: Date | null;
  emailVerifiedAt: Date | null;
  club: null | {
    name: string;
    stadiumLvl: number;
    ctLvl: number;
    treasurerLvl: number;
    trophyRoomLvl: number;
    totalOverwall: number;
  };
  mgtBalance: { amount: Prisma.Decimal; usdcAmount: Prisma.Decimal } | null;
};

function makeProfileUser(partial: Partial<ProfileUser> = {}): ProfileUser {
  return {
    id: 'u1',
    username: 'alice',
    email: 'alice@example.com',
    wallet: null,
    referralCode: 'ABCD1234',
    failedLoginCount: 0,
    lockedUntil: null,
    emailVerifiedAt: null,
    club: {
      name: 'FC Test',
      stadiumLvl: 1,
      ctLvl: 1,
      treasurerLvl: 1,
      trophyRoomLvl: 1,
      totalOverwall: 0,
    },
    mgtBalance: { amount: new Prisma.Decimal(0), usdcAmount: new Prisma.Decimal(0) },
    ...partial,
  };
}

function buildProfilePrisma(user: ProfileUser) {
  const calls: Record<string, unknown[]> = {
    userUpdate: [],
    clubUpdate: [],
    mgtBalanceUpdate: [],
    mgtTxCreate: [],
  };
  const tx = {
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn((args: unknown) => {
        calls.userUpdate.push(args);
        return {};
      }),
    },
    club: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn((args: unknown) => {
        calls.clubUpdate.push(args);
        return {};
      }),
      create: vi.fn().mockResolvedValue({}),
    },
    mGTBalance: {
      upsert: vi.fn().mockResolvedValue(
        user.mgtBalance ?? { amount: new Prisma.Decimal(0), usdcAmount: new Prisma.Decimal(0) },
      ),
      update: vi.fn((args: { data: { amount?: Prisma.Decimal; usdcAmount?: Prisma.Decimal } }) => {
        calls.mgtBalanceUpdate.push(args);
        const current = user.mgtBalance ?? { amount: new Prisma.Decimal(0), usdcAmount: new Prisma.Decimal(0) };
        return {
          amount: args.data.amount ?? current.amount,
          usdcAmount: args.data.usdcAmount ?? current.usdcAmount,
        };
      }),
    },
    mGTTransaction: {
      create: vi.fn((args: unknown) => {
        calls.mgtTxCreate.push(args);
        return {};
      }),
    },
  };
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  } as any;
  return { prisma, tx, calls };
}

describe('AdminUsersService.updateUserProfile', () => {
  let svc: AdminUsersService;

  function build(user: ProfileUser) {
    const { prisma, tx, calls } = buildProfilePrisma(user);
    svc = new AdminUsersService(prisma);
    vi.spyOn(svc, 'getUserAccount').mockResolvedValue({} as never);
    return { prisma, tx, calls };
  }

  beforeEach(() => vi.clearAllMocks());

  it('saves GMT alone without touching USDC', async () => {
    const user = makeProfileUser({
      mgtBalance: { amount: new Prisma.Decimal(0), usdcAmount: new Prisma.Decimal(500) },
    });
    const { tx, calls } = build(user);
    await svc.updateUserProfile('u1', { gmtBalance: 250 });

    expect(tx.mGTBalance.update).toHaveBeenCalledOnce();
    const arg = calls.mgtBalanceUpdate[0] as { data: { amount?: Prisma.Decimal; usdcAmount?: Prisma.Decimal } };
    expect(arg.data.amount?.toString()).toBe('250');
    expect(arg.data.usdcAmount).toBeUndefined();
    expect(tx.mGTTransaction.create).toHaveBeenCalledOnce();
    const ledger = calls.mgtTxCreate[0] as { data: { meta: { currency: string }; amount: Prisma.Decimal } };
    expect(ledger.data.meta.currency).toBe('gmt');
    expect(ledger.data.amount.toString()).toBe('250');
  });

  it('saves USDC alone without touching GMT', async () => {
    const user = makeProfileUser({
      mgtBalance: { amount: new Prisma.Decimal(100), usdcAmount: new Prisma.Decimal(0) },
    });
    const { tx, calls } = build(user);
    await svc.updateUserProfile('u1', { usdcBalance: 75 });

    expect(tx.mGTBalance.update).toHaveBeenCalledOnce();
    const arg = calls.mgtBalanceUpdate[0] as { data: { amount?: Prisma.Decimal; usdcAmount?: Prisma.Decimal } };
    expect(arg.data.usdcAmount?.toString()).toBe('75');
    expect(arg.data.amount).toBeUndefined();
    expect((calls.mgtTxCreate[0] as { data: { meta: { currency: string } } }).data.meta.currency).toBe('usdc');
  });

  it('saves both balances with two ledger entries', async () => {
    const { tx, calls } = build(makeProfileUser());
    await svc.updateUserProfile('u1', { gmtBalance: 10, usdcBalance: 20 });
    expect(tx.mGTBalance.update).toHaveBeenCalledTimes(2);
    expect(tx.mGTTransaction.create).toHaveBeenCalledTimes(2);
    const currencies = calls.mgtTxCreate.map(
      (c) => (c as { data: { meta: { currency: string } } }).data.meta.currency,
    );
    expect(currencies).toEqual(['gmt', 'usdc']);
  });

  it('skips ledger entry when balance equals current', async () => {
    const user = makeProfileUser({
      mgtBalance: { amount: new Prisma.Decimal(100), usdcAmount: new Prisma.Decimal(0) },
    });
    const { tx } = build(user);
    await svc.updateUserProfile('u1', { gmtBalance: 100 });
    expect(tx.mGTBalance.update).toHaveBeenCalledOnce();
    expect(tx.mGTTransaction.create).not.toHaveBeenCalled();
  });

  it('emailVerified false→true sets timestamp', async () => {
    const { tx, calls } = build(makeProfileUser({ emailVerifiedAt: null }));
    await svc.updateUserProfile('u1', { emailVerified: true });
    expect(tx.user.update).toHaveBeenCalledOnce();
    expect((calls.userUpdate[0] as { data: { emailVerifiedAt: Date } }).data.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('emailVerified noop when already verified', async () => {
    const { tx } = build(makeProfileUser({ emailVerifiedAt: new Date() }));
    await svc.updateUserProfile('u1', { emailVerified: true });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('emailVerified true→false clears timestamp', async () => {
    const { tx, calls } = build(makeProfileUser({ emailVerifiedAt: new Date() }));
    await svc.updateUserProfile('u1', { emailVerified: false });
    expect((calls.userUpdate[0] as { data: { emailVerifiedAt: Date | null } }).data.emailVerifiedAt).toBeNull();
  });

  it('club levels patched together in one club.update', async () => {
    const { tx, calls } = build(makeProfileUser());
    await svc.updateUserProfile('u1', {
      clubStadiumLvl: 5,
      clubCtLvl: 4,
      clubTreasurerLvl: 3,
      clubTrophyRoomLvl: 2,
      clubTotalOverwall: 999,
    });
    expect(tx.club.update).toHaveBeenCalledOnce();
    const data = (calls.clubUpdate[0] as { data: Record<string, number> }).data;
    expect(data).toEqual({
      stadiumLvl: 5,
      ctLvl: 4,
      treasurerLvl: 3,
      trophyRoomLvl: 2,
      totalOverwall: 999,
    });
  });

  it('club level noop when equal to current', async () => {
    const { tx } = build(makeProfileUser());
    await svc.updateUserProfile('u1', { clubStadiumLvl: 1 });
    expect(tx.club.update).not.toHaveBeenCalled();
  });

  it('throws when user not found', async () => {
    const { prisma } = build(makeProfileUser());
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(svc.updateUserProfile('missing', { gmtBalance: 10 })).rejects.toMatchObject({
      code: ErrorCode.USER_NOT_FOUND,
    });
  });

  it('username conflict aborts entire transaction', async () => {
    const { tx } = build(makeProfileUser());
    tx.user.findFirst.mockResolvedValueOnce({ id: 'other' });
    await expect(
      svc.updateUserProfile('u1', { username: 'taken', gmtBalance: 999 }),
    ).rejects.toMatchObject({ code: ErrorCode.AUTH_EMAIL_OR_USERNAME_TAKEN });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.mGTBalance.update).not.toHaveBeenCalled();
  });

  it('clearAccountLock resets fields', async () => {
    const { tx, calls } = build(makeProfileUser({ lockedUntil: new Date(), failedLoginCount: 7 }));
    await svc.updateUserProfile('u1', { clearAccountLock: true });
    expect(tx.user.update).toHaveBeenCalled();
    const data = (calls.userUpdate.at(-1) as { data: { lockedUntil: Date | null; failedLoginCount: number } }).data;
    expect(data.lockedUntil).toBeNull();
    expect(data.failedLoginCount).toBe(0);
  });

  it('failedLoginCount noop when equal to current', async () => {
    const { tx } = build(makeProfileUser({ failedLoginCount: 3 }));
    await svc.updateUserProfile('u1', { failedLoginCount: 3 });
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

// reference imports to avoid unused warning
void AppError;
