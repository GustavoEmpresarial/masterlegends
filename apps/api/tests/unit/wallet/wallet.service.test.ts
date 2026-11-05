import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletService } from '../../../src/modules/wallet/wallet.service.js';
import type { WalletRepository } from '../../../src/modules/wallet/wallet.repository.js';
import type { PlatformConfigService } from '../../../src/modules/platform/platform-config.service.js';

describe('WalletService', () => {
  const repo = {
    findUserWallet: vi.fn(),
    getMgtBalance: vi.fn(),
    getLedgerStartedAt: vi.fn(),
    listMergedTransactions: vi.fn(),
    gmtFlowTotals: vi.fn().mockResolvedValue({ received: 0, spent: 0 }),
    findUserByWallet: vi.fn(),
    upsertWalletTransaction: vi.fn(),
  } as unknown as WalletRepository;

  const platform = {
    get: vi.fn().mockResolvedValue({
      minDepositUsdc: 1,
      minWithdrawUsdc: 1,
      withdrawalsPaused: false,
      miningBlockRewardUsdc: 0.009,
      miningBlockIntervalMin: 10,
      miningPaused: false,
    }),
  } as unknown as PlatformConfigService;

  const prisma = {
    club: { findUnique: vi.fn().mockResolvedValue(null) },
    clubLineup: { findUnique: vi.fn().mockResolvedValue(null) },
    vestiarioTemplate: { findFirst: vi.fn().mockResolvedValue(null) },
    miningBalance: { findUnique: vi.fn().mockResolvedValue(null) },
    miningBlock: { findFirst: vi.fn().mockResolvedValue(null) },
    checkInGrant: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    eventOverwallGrant: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    basePlayer: { aggregate: vi.fn().mockResolvedValue({ _sum: { overwall: 0 } }) },
    playerCache: { aggregate: vi.fn().mockResolvedValue({ _sum: { overwall: 0 } }) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $executeRaw: vi.fn().mockResolvedValue(0),
        miningBalance: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
        mGTBalance: { upsert: vi.fn() },
      }),
    ),
    platformConfig: {
      upsert: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        minDepositUsdc: 1,
        minWithdrawUsdc: 1,
        withdrawalsPaused: false,
        vaultAddress: null,
        miningBlockRewardUsdc: 0.009,
        miningBlockIntervalMin: 10,
        miningPaused: false,
        registrationOpen: true,
        maintenanceMode: false,
        maintenanceMessage: null,
        referralBonusPct: 0,
        treasurerWeeklyUsdc: 0,
        coachWeeklyUsdc: 0,
        coachMiningFeePct: 0,
        marketplaceFeeBps: 0,
        mergeDiscountPct: 0,
        scoutDiscountPct: 0,
        referralNftName: '',
        referralNftImageUrl: null,
        referralNftOverwall: 0,
        referralNftPosition: 0,
        referralNftDurationDays: 0,
        referralGiftNftName: '',
        referralGiftNftImageUrl: null,
        referralGiftNftOverwall: 0,
        referralGiftNftPosition: 0,
        socialRewardNftName: '',
        socialRewardNftImageUrl: null,
        socialRewardNftOverwall: 0,
        socialRewardNftPosition: 0,
        socialRewardNftDays: 0,
        allocationJson: [],
        updatedBy: null,
        updatedAt: new Date(),
      }),
    },
  };

  let service: WalletService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WalletService(repo, platform, prisma as never);
  });

  it('returns summary with MGT balance and no wallet', async () => {
    vi.mocked(repo.findUserWallet).mockResolvedValue({ wallet: null });
    vi.mocked(repo.getMgtBalance).mockResolvedValue({ amount: 1500, usdcAmount: 800 } as never);
    vi.mocked(repo.getLedgerStartedAt).mockResolvedValue(null);

    const summary = await service.getSummary('user-1');
    expect(summary.gmtBalance).toBe(1500);
    expect(summary.gmtLocked).toBe(0);
    expect(summary.gmtReceived).toBe(0);
    expect(summary.usdcBalance).toBe(800);
    expect(summary.wallet).toBeNull();
    expect(summary.usdcVaultBalance).toBe(800);
    expect(summary.pendingFarmUsdc).toBe(0);
  });

  it('returns zero balance when MGT balance is null', async () => {
    vi.mocked(repo.findUserWallet).mockResolvedValue({ wallet: null });
    vi.mocked(repo.getMgtBalance).mockResolvedValue(null);
    vi.mocked(repo.getLedgerStartedAt).mockResolvedValue(null);

    const summary = await service.getSummary('user-1');
    expect(summary.gmtBalance).toBe(0);
    expect(summary.usdcBalance).toBe(0);
  });

  it('computes sponsorship metrics from mining when club exists', async () => {
    vi.mocked(repo.findUserWallet).mockResolvedValue({ wallet: null });
    vi.mocked(repo.getMgtBalance).mockResolvedValue({ amount: 500 } as never);
    vi.mocked(repo.getLedgerStartedAt).mockResolvedValue(null);
    vi.mocked(prisma.club.findUnique).mockResolvedValue({ id: 'c1', user: { wallet: null } });
    vi.mocked(prisma.clubLineup.findUnique).mockResolvedValue({ assignments: {} });
    vi.mocked(prisma.miningBlock.findFirst).mockResolvedValue({
      totalOverwall: BigInt(10000),
      blockNumber: BigInt(1),
      minedAt: new Date(),
    });

    const summary = await service.getSummary('user-1');
    expect(summary.usdcPerHour).toBe(0);
    expect(summary.pendingFarmUsdc).toBe(0);
    expect(summary.lineupOverwall).toBe(0);
  });

  it('returns paginated transactions', async () => {
    const items = [
      { type: 'mgt_credit', amount: 100, createdAt: new Date() },
      { type: 'mgt_debit', amount: -50, createdAt: new Date() },
    ];
    vi.mocked(repo.listMergedTransactions).mockResolvedValue({
      items: items as never,
      nextCursor: null,
      ledgerStartedAt: null,
    });

    const result = await service.getTransactions('user-1', { limit: 20 });
    expect(result.items).toHaveLength(2);
    expect(result.items[0].createdAt).toBeTypeOf('string');
    expect(result.nextCursor).toBeNull();
  });

  it('recordUsdcEvent returns null when wallet not mapped to any user', async () => {
    vi.mocked(repo.findUserByWallet as any).mockResolvedValue(null);
    const result = await service.recordUsdcEvent('0xunknown', 'usdc_deposit', 10, '0xtx');
    expect(result).toBeNull();
  });
});
