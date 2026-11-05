import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { MgtTxType } from '@mll/shared';
import { runMiningBlock } from '../../../src/workers/mining.worker.js';

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as any;

interface MockPrismaOpts {
  cfg?: Partial<{
    miningBlockRewardUsdc: Prisma.Decimal | number | string;
    miningBlockIntervalMin: number;
    miningPaused: boolean;
    coachMiningFeePct: number;
  }>;
  lineups?: Array<{
    assignments: unknown;
    club: { userId: string; user: { wallet: string | null } | null };
  }>;
  basePlayers?: Array<{ id: string; userId: string; overwall: number }>;
  nfts?: Array<{ tokenId: bigint; ownerWallet: string; overwall: number }>;
  /** Clubs with hired coach (userId list). */
  coachHiredUserIds?: string[];
  /** Users with active coach affliction. */
  coachAfflictedUserIds?: string[];
  blockCreate?: ReturnType<typeof vi.fn>;
}

function makePrisma(opts: MockPrismaOpts = {}) {
  const cfg = {
    miningBlockRewardUsdc: new Prisma.Decimal(opts.cfg?.miningBlockRewardUsdc ?? 0.1),
    miningBlockIntervalMin: opts.cfg?.miningBlockIntervalMin ?? 10,
    miningPaused: opts.cfg?.miningPaused ?? false,
    coachMiningFeePct: opts.cfg?.coachMiningFeePct ?? 0,
  };
  const blockCreate =
    opts.blockCreate ??
    vi.fn().mockImplementation(({ data }: { data: any }) => ({
      id: 'block-id',
      ...data,
    }));

  let usdcBalance = 0;
  let usdtBalance = 0;
  const tx = {
    miningBlock: { create: blockCreate },
    miningReward: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    miningBalance: { upsert: vi.fn().mockResolvedValue({}) },
    club: { findUnique: vi.fn().mockResolvedValue(null) },
    mGTBalance: {
      upsert: vi.fn().mockResolvedValue({ amount: 0, usdcAmount: 0, usdtAmount: 0 }),
      findUnique: vi.fn().mockImplementation(async () => ({
        userId: 'x',
        amount: new Prisma.Decimal(0),
        usdcAmount: new Prisma.Decimal(usdcBalance),
        usdtAmount: new Prisma.Decimal(usdtBalance),
      })),
      update: vi.fn().mockImplementation(async ({ data }: { data: any }) => {
        if (data.usdcAmount?.increment) {
          usdcBalance += Number(data.usdcAmount.increment);
        }
        if (data.usdcAmount?.decrement) {
          usdcBalance -= Number(data.usdcAmount.decrement);
        }
        if (data.usdtAmount?.increment) {
          usdtBalance += Number(data.usdtAmount.increment);
        }
        if (data.usdtAmount?.decrement) {
          usdtBalance -= Number(data.usdtAmount.decrement);
        }
        return {
          amount: new Prisma.Decimal(0),
          usdcAmount: new Prisma.Decimal(usdcBalance),
          usdtAmount: new Prisma.Decimal(usdtBalance),
        };
      }),
    },
    mGTTransaction: { create: vi.fn().mockResolvedValue({}) },
  };

  const hiredIds = opts.coachHiredUserIds ?? [];
  const afflictedIds = opts.coachAfflictedUserIds ?? [];

  const prisma = {
    platformConfig: { upsert: vi.fn().mockResolvedValue(cfg) },
    miningBlock: { create: blockCreate },
    clubLineup: {
      findMany: vi.fn().mockResolvedValue(opts.lineups ?? []),
    },
    basePlayer: {
      findMany: vi.fn().mockResolvedValue(opts.basePlayers ?? []),
    },
    playerCache: {
      findMany: vi.fn().mockResolvedValue(opts.nfts ?? []),
    },
    club: {
      findMany: vi.fn().mockResolvedValue(
        hiredIds.map((userId) => ({ userId, coachHiredAt: new Date() })),
      ),
    },
    affliction: {
      findMany: vi.fn().mockResolvedValue(afflictedIds.map((userId) => ({ userId }))),
    },
    checkInGrant: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    eventOverwallGrant: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    vestiarioTemplate: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    playerGearEquip: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  };
  return prisma as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runMiningBlock', () => {
  it('skips when miningPaused', async () => {
    const prisma = makePrisma({ cfg: { miningPaused: true } });
    const res = await runMiningBlock(prisma, logger);
    expect(res.skipped).toBe('paused');
    expect(prisma.miningBlock.create).not.toHaveBeenCalled();
  });

  it('creates empty block and skips when no overwall', async () => {
    const prisma = makePrisma({ lineups: [] });
    const res = await runMiningBlock(prisma, logger);
    expect(res.skipped).toBe('no-overwall');
    expect(res.participantCount).toBe(0);
    expect(prisma.miningBlock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalOverwall: 0n, participantCount: 0 }),
      }),
    );
  });

  it('distributes proportionally using only stadium lineup players', async () => {
    const prisma = makePrisma({
      lineups: [
        {
          assignments: {
            gk: { kind: 'base', playerId: 'b1' },
            fw: { kind: 'nft', playerId: '7' },
          },
          club: { userId: 'A', user: { wallet: '0xaaa' } },
        },
        {
          assignments: { mid: { kind: 'base', playerId: 'b9' } },
          club: { userId: 'C', user: { wallet: '0xccc' } },
        },
      ],
      basePlayers: [
        { id: 'b1', userId: 'A', overwall: 100 },
        { id: 'b9', userId: 'C', overwall: 300 },
      ],
      nfts: [{ tokenId: 7n, ownerWallet: '0xaaa', overwall: 600 }],
    });

    const res = await runMiningBlock(prisma, logger);
    expect(res.skipped).toBeUndefined();
    expect(res.participantCount).toBe(2);
    expect(res.totalOverwall).toBe(1000);

    const createMany = prisma.__tx.miningReward.createMany;
    const rewards = createMany.mock.calls[0][0].data as Array<{
      userId: string;
      amountUsdc: Prisma.Decimal;
      overwallSnapshot: number;
    }>;

    expect(rewards.map((r) => r.userId).sort()).toEqual(['A', 'C']);
    const sum = rewards.reduce(
      (acc, r) => acc.add(r.amountUsdc),
      new Prisma.Decimal(0),
    );
    expect(sum.toString()).toBe('0.1');

    const a = rewards.find((r) => r.userId === 'A')!;
    expect(a.overwallSnapshot).toBe(700);
    expect(a.amountUsdc.toNumber()).toBeCloseTo(0.07, 6);
  });

  it('keeps the truncated remainder on the block instead of the last participant', async () => {
    const prisma = makePrisma({
      lineups: [
        {
          assignments: { s1: { kind: 'base', playerId: 'b1' } },
          club: { userId: 'A', user: { wallet: null } },
        },
        {
          assignments: { s1: { kind: 'base', playerId: 'b4' } },
          club: { userId: 'B', user: { wallet: null } },
        },
        {
          assignments: { s1: { kind: 'base', playerId: 'b5' } },
          club: { userId: 'C', user: { wallet: null } },
        },
      ],
      basePlayers: [
        { id: 'b1', userId: 'A', overwall: 1 },
        { id: 'b4', userId: 'B', overwall: 1 },
        { id: 'b5', userId: 'C', overwall: 1 },
      ],
    });

    await runMiningBlock(prisma, logger);
    const rewards = prisma.__tx.miningReward.createMany.mock.calls[0][0].data;
    const sum = rewards.reduce(
      (acc: Prisma.Decimal, r: any) => acc.add(r.amountUsdc),
      new Prisma.Decimal(0),
    );
    const residual = prisma.__tx.miningBlock.create.mock.calls[0][0].data.residualUsdt as Prisma.Decimal;
    expect(rewards.map((r: { amountUsdc: Prisma.Decimal }) => r.amountUsdc.toString())).toEqual([
      '0.033333',
      '0.033333',
      '0.033333',
    ]);
    expect(residual.toString()).toBe('0.000001');
    expect(sum.add(residual).toString()).toBe('0.1');
  });

  it('passes extended transaction options for large participant sets', async () => {
    const prisma = makePrisma({
      lineups: [
        {
          assignments: { s1: { kind: 'base', playerId: 'b1' } },
          club: { userId: 'A', user: { wallet: null } },
        },
      ],
      basePlayers: [{ id: 'b1', userId: 'A', overwall: 100 }],
    });

    await runMiningBlock(prisma, logger);
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: 120_000, maxWait: 15_000 }),
    );
  });

  it('reports duplicate when block already exists (P2002)', async () => {
    const dup = Object.assign(new Error('dup'), {
      code: 'P2002',
      clientVersion: '5',
    });
    Object.setPrototypeOf(dup, Prisma.PrismaClientKnownRequestError.prototype);

    const prisma = makePrisma({
      lineups: [
        {
          assignments: { s1: { kind: 'base', playerId: 'b1' } },
          club: { userId: 'A', user: { wallet: null } },
        },
      ],
      basePlayers: [{ id: 'b1', userId: 'A', overwall: 100 }],
      blockCreate: vi.fn().mockRejectedValue(dup),
    });

    const res = await runMiningBlock(prisma, logger);
    expect(res.skipped).toBe('duplicate');
  });

  it('debits coach_fee when coach is hired and fee pct > 0', async () => {
    const prisma = makePrisma({
      cfg: { coachMiningFeePct: 0.02, miningBlockRewardUsdc: 1 },
      coachHiredUserIds: ['A'],
      lineups: [
        {
          assignments: { s1: { kind: 'base', playerId: 'b1' } },
          club: { userId: 'A', user: { wallet: null } },
        },
      ],
      basePlayers: [{ id: 'b1', userId: 'A', overwall: 100 }],
    });

    await runMiningBlock(prisma, logger);

    const txCreates = prisma.__tx.mGTTransaction.create.mock.calls.map((c: any) => c[0].data);
    expect(txCreates.some((d: any) => d.type === MgtTxType.MINING_CLAIM)).toBe(true);
    const feeTx = txCreates.find((d: any) => d.type === MgtTxType.COACH_FEE);
    expect(feeTx).toBeDefined();
    expect(Number(feeTx.amount)).toBeCloseTo(-0.02, 6);
    expect(feeTx.meta).toMatchObject({ source: 'mining_block', feePct: 0.02, gross: 1 });

    const lifetime = prisma.__tx.miningBalance.upsert.mock.calls[0][0];
    expect(Number(lifetime.create.lifetimeEarned)).toBeCloseTo(0.98, 6);
  });

  it('does not debit coach_fee when coach is afflicted', async () => {
    const prisma = makePrisma({
      cfg: { coachMiningFeePct: 0.02, miningBlockRewardUsdc: 1 },
      coachHiredUserIds: ['A'],
      coachAfflictedUserIds: ['A'],
      lineups: [
        {
          assignments: { s1: { kind: 'base', playerId: 'b1' } },
          club: { userId: 'A', user: { wallet: null } },
        },
      ],
      basePlayers: [{ id: 'b1', userId: 'A', overwall: 100 }],
    });

    await runMiningBlock(prisma, logger);
    const types = prisma.__tx.mGTTransaction.create.mock.calls.map((c: any) => c[0].data.type);
    expect(types).toContain(MgtTxType.MINING_CLAIM);
    expect(types).not.toContain(MgtTxType.COACH_FEE);
  });

  it('does not debit coach_fee when pct is 0', async () => {
    const prisma = makePrisma({
      cfg: { coachMiningFeePct: 0, miningBlockRewardUsdc: 1 },
      coachHiredUserIds: ['A'],
      lineups: [
        {
          assignments: { s1: { kind: 'base', playerId: 'b1' } },
          club: { userId: 'A', user: { wallet: null } },
        },
      ],
      basePlayers: [{ id: 'b1', userId: 'A', overwall: 100 }],
    });

    await runMiningBlock(prisma, logger);
    const types = prisma.__tx.mGTTransaction.create.mock.calls.map((c: any) => c[0].data.type);
    expect(types).not.toContain(MgtTxType.COACH_FEE);
    // club.findMany skipped when pct is 0
    expect(prisma.club.findMany).not.toHaveBeenCalled();
  });

  it('pays full share to a watching user and 70% when the stadium tab is closed', async () => {
    const prisma = makePrisma({
      cfg: { miningBlockRewardUsdc: 1 },
      lineups: [
        {
          assignments: { s1: { kind: 'base', playerId: 'b1' } },
          club: { userId: 'A', user: { wallet: null } },
        },
        {
          assignments: { s1: { kind: 'base', playerId: 'b2' } },
          club: { userId: 'B', user: { wallet: null } },
        },
      ],
      basePlayers: [
        { id: 'b1', userId: 'A', overwall: 100 },
        { id: 'b2', userId: 'B', overwall: 100 },
      ],
    });
    const redis = {
      mget: vi.fn(async (...keys: string[]) => keys.map((key) => (key.endsWith(':A') ? '1' : null))),
    };

    await runMiningBlock(prisma, logger, redis);

    const rewards = prisma.__tx.miningReward.createMany.mock.calls[0][0].data as Array<{
      userId: string;
      amountUsdc: Prisma.Decimal;
    }>;
    expect(rewards.find((r) => r.userId === 'A')!.amountUsdc.toString()).toBe('0.5');
    expect(rewards.find((r) => r.userId === 'B')!.amountUsdc.toString()).toBe('0.35');

    const residual = prisma.__tx.miningBlock.create.mock.calls[0][0].data.residualUsdt as Prisma.Decimal;
    expect(residual.toString()).toBe('0.15');

    const claims = prisma.__tx.mGTTransaction.create.mock.calls.map((c: any) => c[0].data);
    expect(claims.find((d: any) => d.userId === 'A' && d.type === MgtTxType.MINING_CLAIM).meta.presenceRate).toBe(1);
    expect(claims.find((d: any) => d.userId === 'B' && d.type === MgtTxType.MINING_CLAIM).meta.presenceRate).toBe(0.7);
  });
});
