import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { MiningService } from '../../../src/modules/mining/mining.service.js';

vi.mock('../../../src/modules/platform/platform-config.service.js', () => {
  const get = vi.fn();
  const PlatformConfigService = vi.fn().mockImplementation(() => ({ get }));
  return { PlatformConfigService, __get: get };
});

const platformMod = await import(
  '../../../src/modules/platform/platform-config.service.js'
);
const platformGet = (platformMod as unknown as { __get: ReturnType<typeof vi.fn> }).__get;

function makePrisma(overrides: Partial<Record<string, unknown>> = {}) {
  const base = {
    club: { findUnique: vi.fn() },
    clubLineup: { findUnique: vi.fn() },
    clubStadiumLicense: {
      findUnique: vi.fn().mockResolvedValue({ status: 'signed' }),
    },
    basePlayer: { aggregate: vi.fn() },
    playerCache: { aggregate: vi.fn() },
    playerGearEquip: { findMany: vi.fn().mockResolvedValue([]) },
    checkInGrant: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    eventOverwallGrant: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    miningBalance: { findUnique: vi.fn(), update: vi.fn() },
    mGTBalance: { upsert: vi.fn().mockResolvedValue({ amount: 0 }) },
    mGTTransaction: { create: vi.fn().mockResolvedValue({}) },
    miningBlock: { findFirst: vi.fn() },
    miningReward: { findMany: vi.fn() },
    withdrawalRequest: { create: vi.fn() },
    $executeRaw: vi.fn().mockResolvedValue(0),
    $transaction: vi.fn(async (fn: any) => fn(base)),
  };
  Object.assign(base, overrides);
  return base as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  platformGet.mockResolvedValue({
    minDepositUsdc: 1,
    minWithdrawUsdc: 1,
    withdrawalsPaused: false,
    miningBlockRewardUsdc: 0.1,
    miningBlockIntervalMin: 10,
    miningPaused: false,
  });
});

describe('MiningService.getUserOverwall', () => {
  it('sums only players assigned to the stadium lineup', async () => {
    const prisma = makePrisma();
    prisma.club.findUnique.mockResolvedValue({
      id: 'club-1',
      user: { wallet: '0xAbC' },
    });
    prisma.clubLineup.findUnique.mockResolvedValue({
      assignments: {
        gk: { kind: 'base', playerId: 'b1' },
        fw: { kind: 'nft', playerId: '42' },
      },
      stadiumTemplate: { name: 'Campo', farmBonusPct: 0 },
    });
    prisma.basePlayer.aggregate.mockResolvedValue({ _sum: { overwall: 500 } });
    prisma.playerCache.aggregate.mockResolvedValue({ _sum: { overwall: 1500 } });

    const svc = new MiningService(prisma);
    expect(await svc.getUserOverwall('u1')).toBe(2000);
    expect(prisma.basePlayer.aggregate).toHaveBeenCalledWith({
      where: { id: { in: ['b1'] }, userId: 'u1' },
      _sum: { overwall: true },
    });
    expect(prisma.playerCache.aggregate).toHaveBeenCalledWith({
      where: { tokenId: { in: [42n] }, ownerWallet: '0xabc' },
      _sum: { overwall: true },
    });
  });

  it('returns 0 when user has no lineup saved', async () => {
    const prisma = makePrisma();
    prisma.club.findUnique.mockResolvedValue({
      id: 'club-1',
      user: { wallet: '0x1' },
    });
    prisma.clubLineup.findUnique.mockResolvedValue(null);

    const svc = new MiningService(prisma);
    expect(await svc.getUserOverwall('u1')).toBe(0);
    expect(prisma.basePlayer.aggregate).not.toHaveBeenCalled();
  });

  it('returns 0 when lineup is empty', async () => {
    const prisma = makePrisma();
    prisma.club.findUnique.mockResolvedValue({
      id: 'club-1',
      user: { wallet: null },
    });
    prisma.clubLineup.findUnique.mockResolvedValue({
      assignments: {},
      stadiumTemplate: { name: 'Campo', farmBonusPct: 0 },
    });

    const svc = new MiningService(prisma);
    expect(await svc.getUserOverwall('u1')).toBe(0);
    expect(prisma.basePlayer.aggregate).not.toHaveBeenCalled();
  });

  it('adds stadium farm bonus over lineup power', async () => {
    const prisma = makePrisma();
    prisma.club.findUnique.mockResolvedValue({
      id: 'club-1',
      user: { wallet: null },
    });
    prisma.clubLineup.findUnique.mockResolvedValue({
      assignments: { s1: { kind: 'base', playerId: 'b1' } },
      stadiumTemplate: { name: 'MASTER NOTURNO', farmBonusPct: 0.02 },
    });
    prisma.basePlayer.aggregate.mockResolvedValue({ _sum: { overwall: 3750 } });

    const svc = new MiningService(prisma);
    // 3750 + floor(3750 * 0.02) = 3750 + 75
    expect(await svc.getUserOverwall('u1')).toBe(3825);
    const parts = await svc.getLineupOverwallParts('u1');
    expect(parts.stadiumBonusOverwall).toBe(75);
    expect(parts.stadiumFarmBonusPct).toBe(0.02);
  });
});

describe('MiningService.getSummary', () => {
  it('computes share, estimated reward and last block info', async () => {
    const prisma = makePrisma();
    prisma.club.findUnique.mockResolvedValue({
      id: 'club-1',
      user: { wallet: '0xa' },
    });
    prisma.clubLineup.findUnique.mockResolvedValue({
      assignments: {
        s1: { kind: 'base', playerId: 'b1' },
        s2: { kind: 'nft', playerId: '1' },
      },
      stadiumTemplate: { name: 'Campo', farmBonusPct: 0 },
    });
    prisma.basePlayer.aggregate.mockResolvedValue({ _sum: { overwall: 100 } });
    prisma.playerCache.aggregate.mockResolvedValue({ _sum: { overwall: 100 } });
    prisma.miningBalance.findUnique.mockResolvedValue({
      pending: new Prisma.Decimal('0'),
      lifetimeEarned: new Prisma.Decimal('3.25'),
    });
    prisma.miningBlock.findFirst.mockResolvedValue({
      blockNumber: BigInt(42),
      totalOverwall: BigInt(1000),
      minedAt: new Date('2026-06-06T00:00:00Z'),
    });

    const svc = new MiningService(prisma);
    const s = await svc.getSummary('u1');
    expect(s.currentOverwall).toBe(200);
    expect(s.networkOverwall).toBe(1000);
    expect(s.sharePct).toBeCloseTo(20);
    expect(s.estimatedPerBlock).toBeCloseTo(0.02);
    expect(s.lifetimeEarned).toBe(3.25);
    expect(s.lastBlockNumber).toBe(42);
  });

  it('cuts the estimate to 70% when the stadium tab is closed', async () => {
    const prisma = makePrisma();
    prisma.club.findUnique.mockResolvedValue({
      id: 'club-1',
      user: { wallet: '0xa' },
    });
    prisma.clubLineup.findUnique.mockResolvedValue({
      assignments: {
        s1: { kind: 'base', playerId: 'b1' },
        s2: { kind: 'nft', playerId: '1' },
      },
      stadiumTemplate: { name: 'Campo', farmBonusPct: 0 },
    });
    prisma.vestiarioTemplate = { findFirst: vi.fn().mockResolvedValue(null) };
    prisma.basePlayer.findMany = vi.fn().mockResolvedValue([
      {
        id: 'b1',
        stamina: 100,
        position: 0,
        rarity: 0,
        attributes: {
          ataque: 0,
          defesa: 0,
          passe: 0,
          velocidade: 0,
          finalizacao: 0,
          forca: 0,
          resistencia: 0,
          tecnica: 0,
          inteligencia: 0,
          goleiro: 0,
        },
      },
    ]);
    prisma.playerCache.findMany = vi.fn().mockResolvedValue([]);
    prisma.miningBalance.findUnique.mockResolvedValue({
      pending: new Prisma.Decimal('0'),
      lifetimeEarned: new Prisma.Decimal('0'),
    });
    prisma.miningBlock.findFirst.mockResolvedValue({
      blockNumber: BigInt(42),
      totalOverwall: BigInt(1000),
      minedAt: new Date('2026-06-06T00:00:00Z'),
    });

    const redis = { exists: vi.fn().mockResolvedValue(0) };
    const svc = new MiningService(prisma, redis);
    const s = await svc.getSummary('u1');
    expect(redis.exists).toHaveBeenCalled();
    expect(s.stadiumWatching).toBe(false);
    expect(s.presenceRate).toBe(0.7);
    expect(s.estimatedPerBlock).toBeCloseTo(0.00007);
  });

  it('share=0 when no blocks yet', async () => {
    const prisma = makePrisma();
    prisma.club.findUnique.mockResolvedValue({
      id: 'club-1',
      user: { wallet: null },
    });
    prisma.clubLineup.findUnique.mockResolvedValue({
      assignments: { s1: { kind: 'base', playerId: 'b1' } },
      stadiumTemplate: { name: 'Campo', farmBonusPct: 0 },
    });
    prisma.basePlayer.aggregate.mockResolvedValue({ _sum: { overwall: 100 } });
    prisma.miningBalance.findUnique.mockResolvedValue(null);
    prisma.miningBlock.findFirst.mockResolvedValue(null);

    const svc = new MiningService(prisma);
    const s = await svc.getSummary('u1');
    expect(s.sharePct).toBe(0);
    expect(s.estimatedPerBlock).toBe(0);
    expect(s.lastBlockNumber).toBeNull();
  });
});

describe('MiningService.listBlocks / listHistory', () => {
  it('maps blocks decimal fields to numbers', async () => {
    const prisma = makePrisma({
      miningBlock: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          {
            blockNumber: BigInt(2),
            minedAt: new Date('2026-06-06T01:00:00Z'),
            totalOverwall: BigInt(500),
            rewardUsdc: new Prisma.Decimal('0.1'),
            participantCount: 3,
          },
        ]),
      },
    });
    const svc = new MiningService(prisma);
    const list = await svc.listBlocks(1);
    expect(list[0]).toMatchObject({
      blockNumber: 2,
      totalOverwall: 500,
      rewardUsdc: 0.1,
      participantCount: 3,
    });
  });

  it('clamps limit and returns mapped history', async () => {
    const prisma = makePrisma({
      miningReward: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'r1',
            overwallSnapshot: 200,
            share: new Prisma.Decimal('0.2'),
            amountUsdc: new Prisma.Decimal('0.02'),
            createdAt: new Date(),
            block: { blockNumber: BigInt(5), totalOverwall: BigInt(1000) },
          },
        ]),
      },
    });
    const svc = new MiningService(prisma);
    const list = await svc.listHistory('u1', 99999);
    expect(prisma.miningReward.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
    expect(list[0]).toMatchObject({
      blockNumber: 5,
      share: 0.2,
      amountUsdc: 0.02,
    });
  });
});

describe('MiningService.flushLegacyPending', () => {
  it('credits legacy pending balance to game wallet on summary load', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      miningBalance: {
        findUnique: vi.fn().mockResolvedValue({ pending: new Prisma.Decimal('1.5') }),
        update: vi.fn().mockResolvedValue({}),
      },
      mGTBalance: {
        upsert: vi.fn().mockResolvedValue({ usdtAmount: 0 }),
        update: vi.fn().mockResolvedValue({ usdtAmount: new Prisma.Decimal('1.5') }),
      },
      mGTTransaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const prisma = makePrisma({
      $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    });
    prisma.club.findUnique.mockResolvedValue({
      id: 'club-1',
      user: { wallet: null },
    });
    prisma.clubLineup.findUnique.mockResolvedValue({
      assignments: {},
      stadiumTemplate: { name: 'Campo', farmBonusPct: 0 },
    });
    prisma.miningBalance.findUnique.mockResolvedValue({
      pending: new Prisma.Decimal('0'),
      lifetimeEarned: new Prisma.Decimal('1.5'),
    });
    prisma.miningBlock.findFirst.mockResolvedValue(null);

    const svc = new MiningService(prisma);
    await svc.getSummary('u1');
    expect(tx.mGTBalance.upsert).toHaveBeenCalled();
    expect(tx.miningBalance.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { pending: 0 },
    });
  });
});
