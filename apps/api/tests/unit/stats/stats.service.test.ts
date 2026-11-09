import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatsService } from '../../../src/modules/stats/stats.service.js';

function makePrisma(overrides = {}) {
  return {
    user: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    basePlayer: { count: vi.fn().mockResolvedValue(0) },
    vestiarioTemplate: { findFirst: vi.fn().mockResolvedValue(null) },
    playerCache: { count: vi.fn().mockResolvedValue(0) },
    walletTransaction: {
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
    },
    ...overrides,
  } as any;
}

describe('StatsService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getPublicStats', () => {
    it('returns zero stats when database is empty', async () => {
      const svc = new StatsService(makePrisma());
      const stats = await svc.getPublicStats();
      expect(stats.registeredUsers).toBe(0);
      expect(stats.nftsMinted).toBe(0);
      expect(stats.totalDepositedUsd).toBe(0);
      expect(stats.launchedAt).toBeTruthy();
    });

    it('sums base players and on-chain players as nftsMinted', async () => {
      const prisma = makePrisma();
      prisma.user.count.mockResolvedValue(150);
      prisma.basePlayer.count.mockResolvedValue(300);
      prisma.playerCache.count.mockResolvedValue(50);

      const svc = new StatsService(prisma);
      const stats = await svc.getPublicStats();
      expect(stats.registeredUsers).toBe(150);
      expect(stats.nftsMinted).toBe(350);
    });

    it('uses oldest user createdAt as launchedAt when config not set', async () => {
      const prisma = makePrisma();
      const oldDate = new Date('2025-01-15T08:00:00Z');
      prisma.user.findFirst.mockResolvedValue({ createdAt: oldDate });

      const svc = new StatsService(prisma);
      const stats = await svc.getPublicStats();
      expect(stats.launchedAt).toBe(oldDate.toISOString());
    });

    it('falls back to hardcoded date when no users exist', async () => {
      const prisma = makePrisma();
      prisma.user.findFirst.mockResolvedValue(null);

      const svc = new StatsService(prisma);
      const stats = await svc.getPublicStats();
      expect(stats.launchedAt).toBeTruthy();
    });
  });

  describe('getPublicWalletActivity', () => {
    it('returns empty arrays when no transactions exist', async () => {
      const svc = new StatsService(makePrisma());
      const activity = await svc.getPublicWalletActivity();
      expect(activity.deposits).toHaveLength(0);
      expect(activity.withdrawals).toHaveLength(0);
    });

    it('maps transactions with masked wallet and absolute amount', async () => {
      const now = new Date('2026-06-08T12:00:00Z');
      const prisma = makePrisma();
      prisma.walletTransaction.findMany
        .mockResolvedValueOnce([
          {
            id: 'tx-1',
            amount: { valueOf: () => 25 },
            txHash: '0xtxhash',
            createdAt: now,
            user: { wallet: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12' },
          },
        ])
        .mockResolvedValueOnce([]);

      const svc = new StatsService(prisma);
      const activity = await svc.getPublicWalletActivity();
      expect(activity.deposits).toHaveLength(1);
      expect(activity.deposits[0].amountUsdc).toBe(25);
      expect(activity.deposits[0].walletMasked).toBe('0xAbCd...Ef12');
      expect(activity.deposits[0].createdAt).toBe(now.toISOString());
    });

    it('queries deposits and withdrawals separately with correct filters', async () => {
      const prisma = makePrisma();
      const svc = new StatsService(prisma);
      await svc.getPublicWalletActivity();

      const [depositCall, withdrawCall] = prisma.walletTransaction.findMany.mock.calls;
      expect(depositCall[0].where.type).toBe('usdc_deposit');
      expect(withdrawCall[0].where.type).toBe('usdc_withdraw');
    });
  });

  describe('getClubRanking', () => {
    it('ranks clubs by lineup overwall only, not top-11 squad sum', async () => {
      const prisma = makePrisma({
        club: {
          findMany: vi.fn().mockResolvedValue([
            {
              name: 'Alpha FC',
              stadiumLvl: 1,
              userId: 'u1',
              user: { username: 'alpha', wallet: null },
            },
            {
              name: 'Beta FC',
              stadiumLvl: 1,
              userId: 'u2',
              user: { username: 'beta', wallet: null },
            },
          ]),
        },
        clubLineup: {
          findMany: vi.fn().mockResolvedValue([
            {
              assignments: { gk: { playerId: 'p1', kind: 'base' } },
              club: { userId: 'u1', user: { wallet: null } },
            },
          ]),
        },
        basePlayer: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([
            { id: 'p1', userId: 'u1', overwall: 58000 },
            { id: 'p2', userId: 'u2', overwall: 602000 },
          ]),
        },
      });

      const svc = new StatsService(prisma);
      const ranking = await svc.getClubRanking();
      expect(ranking.clubs).toHaveLength(1);
      expect(ranking.clubs[0].clubName).toBe('Alpha FC');
      expect(ranking.clubs[0].totalOverwall).toBe(58000);
    });
  });
});
