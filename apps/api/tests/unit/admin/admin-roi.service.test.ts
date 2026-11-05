import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminRoiService } from '../../../src/modules/admin/admin-roi.service.js';
import { ErrorCode } from '@mll/shared';

function mockPrisma() {
  return {
    user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn().mockResolvedValue(42) },
    platformConfig: { findUnique: vi.fn(), upsert: vi.fn() },
    miningBalance: { findUnique: vi.fn() },
    mGTTransaction: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    walletTransaction: { aggregate: vi.fn() },
    miningReward: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    miningBlock: { aggregate: vi.fn(), findMany: vi.fn() },
    $queryRaw: vi.fn(),
  };
}

describe('AdminRoiService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: AdminRoiService;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new AdminRoiService(prisma as never);
  });

  it('getUserRoi throws when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getUserRoi('missing')).rejects.toMatchObject({
      code: ErrorCode.USER_NOT_FOUND,
    });
  });

  it('getUserRoi computes capital and mining totals', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'alice',
      email: 'a@test.com',
      mgtBalance: { usdcAmount: 50 },
    });
    prisma.platformConfig.findUnique.mockResolvedValue({
      miningBlockRewardUsdc: 10,
      miningBlockIntervalMin: 10,
      miningPaused: false,
    });
    prisma.miningBalance.findUnique.mockResolvedValue({ lifetimeEarned: 20 });
    prisma.mGTTransaction.findMany.mockResolvedValue([
      { type: 'usdc_deposit', amount: 100, meta: { currency: 'usdc' } },
      { type: 'admin_adjust', amount: 10, meta: { currency: 'usdc', source: 'admin_panel' } },
      { type: 'mining_claim', amount: 20, meta: { currency: 'usdc' } },
    ]);
    prisma.walletTransaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 100 }, _count: 1 })
      .mockResolvedValueOnce({ _sum: { amount: 0 }, _count: 0 });
    prisma.miningReward.findMany
      .mockResolvedValueOnce([
        {
          blockId: 'b1',
          overwallSnapshot: 100,
          amountUsdc: 5,
          createdAt: new Date('2026-01-01T12:00:00Z'),
          block: { blockNumber: 1n, totalOverwall: 1000n, rewardUsdc: 10 },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          overwallSnapshot: 100,
          block: { totalOverwall: 1000n, rewardUsdc: 10 },
        },
      ]);
    prisma.mGTTransaction.aggregate.mockResolvedValue({ _sum: { amount: 20 } });
    prisma.miningReward.aggregate.mockResolvedValue({ _sum: { amountUsdc: 20 }, _count: 2 });

    const roi = await service.getUserRoi('u1');

    expect(roi.capital.depositsUsdc).toBe(100);
    expect(roi.capital.adminCreditsUsdc).toBe(10);
    expect(roi.capital.netCapitalIn).toBe(110);
    expect(roi.mining.totalPaidUsdc).toBe(20);
    expect(roi.mining.totalLedgerUsdc).toBe(20);
    expect(roi.balances.currentUsdc).toBe(50);
    expect(roi.balances.ledgerUsdcSum).toBe(130);
    expect(roi.roi.percentOnCapital).toBeCloseTo((20 / 110) * 100, 2);
  });

  it('getPlatformRoi flags pool vs distributed drift', async () => {
    prisma.platformConfig.upsert.mockResolvedValue({
      miningBlockRewardUsdc: 10,
      miningBlockIntervalMin: 10,
      miningPaused: false,
    });
    prisma.miningBlock.aggregate.mockResolvedValue({ _sum: { rewardUsdc: 100 }, _count: 10 });
    prisma.miningReward.aggregate
      .mockResolvedValueOnce({ _sum: { amountUsdc: 105 } })
      .mockResolvedValueOnce({ _sum: { amountUsdc: 0 } });
    prisma.mGTTransaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 105 } })
      .mockResolvedValueOnce({ _sum: { amount: 200 } })
      .mockResolvedValueOnce({ _sum: { amount: -50 } });
    prisma.miningBlock.findMany.mockResolvedValue([]);
    prisma.mGTTransaction.findMany.mockResolvedValue([]);
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 10n }]);

    const platform = await service.getPlatformRoi();

    expect(platform.totals.poolVsDistributedDriftUsdc).toBe(5);
    expect(platform.alertLevel).toBe('critical');
    expect(platform.roi.percentOnCapital).not.toBeNull();
    expect(platform.roi.minersCount).toBeDefined();
    expect(platform.alerts.length).toBeGreaterThan(0);
  });
});
