import type { WalletTransactionsQuery } from '@mll/shared';
import { GMT_USDC_SWAP_RATE } from '@mll/shared';
import type { PrismaClient } from '@prisma/client';
import { config } from '../../config/env.js';
import { MiningService } from '../mining/mining.service.js';
import { PlatformConfigService } from '../platform/platform-config.service.js';
import { WalletRepository } from './wallet.repository.js';

export class WalletService {
  private readonly miningService: MiningService;

  constructor(
    private readonly repo: WalletRepository,
    private readonly platform: PlatformConfigService,
    prisma: PrismaClient,
    redis?: { exists(key: string): Promise<number> },
  ) {
    this.miningService = new MiningService(prisma, redis);
  }

  async getSummary(userId: string) {
    const user = await this.repo.findUserWallet(userId);
    const balance = await this.repo.getMgtBalance(userId);
    const summary = await this.miningService.getSummary(userId);
    const intervalMin = Math.max(1, summary.blockIntervalMin);
    const estimatedUsdcPerRound = summary.paused ? 0 : summary.estimatedPerBlock;
    const usdcPerHour = estimatedUsdcPerRound * (60 / intervalMin);

    const wallet = user?.wallet ?? null;
    const gmtBalance = Number(balance?.amount ?? 0);
    const gmtLocked = Number(balance?.lockedAmount ?? 0);
    const usdcBalance = Number(balance?.usdcAmount ?? 0);
    const usdtBalance = Number(balance?.usdtAmount ?? 0);
    const usdtLocked = Number(balance?.usdtLockedAmount ?? 0);
    const flow = await this.repo.gmtFlowTotals(userId);
    const usdcVaultBalance = usdcBalance;

    const ledgerStartedAt = await this.repo.getLedgerStartedAt(userId);
    const cfg = await this.platform.get();

    return {
      wallet,
      gmtBalance,
      gmtLocked,
      usdcBalance,
      usdtBalance,
      usdtLocked,
      gmtReceived: flow.received,
      gmtSpent: flow.spent,
      pendingFarmUsdc: 0,
      usdcPerHour,
      estimatedUsdcPerRound,
      lineupOverwall: summary.currentOverwall,
      usdcVaultBalance,
      swapRate: GMT_USDC_SWAP_RATE,
      chainId: config.CHAIN_ID,
      usdcVaultAddress: config.CONTRACT_USDC_VAULT || null,
      usdcAddress: config.USDC_ADDRESS,
      usdtAddress: config.USDT_ADDRESS,
      ledgerStartedAt,
      minDepositUsdc: cfg.minDepositUsdc,
      minWithdrawUsdc: cfg.minWithdrawUsdc,
      withdrawFeePct: cfg.withdrawFeePct,
      withdrawalsPaused: cfg.withdrawalsPaused,
    };
  }

  async getMiningAnalytics(userId: string, days = 30) {
    const span = Math.min(60, Math.max(7, days));
    const balance = await this.repo.getMgtBalance(userId);
    const usdtBalance = Number(balance?.usdtAmount ?? 0);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (span - 1));
    const flows = await this.repo.usdtDailyFlow(userId, since);
    const byDay = new Map(
      flows.map((row) => [row.day.toISOString().slice(0, 10), row]),
    );
    const points: Array<{ date: string; mined: number; withdrawn: number; balance: number }> = [];
    for (let i = 0; i < span; i += 1) {
      const day = new Date(since);
      day.setUTCDate(since.getUTCDate() + i);
      const key = day.toISOString().slice(0, 10);
      const flow = byDay.get(key);
      points.push({
        date: key,
        mined: flow?.mined ?? 0,
        withdrawn: flow?.withdrawn ?? 0,
        balance: 0,
      });
    }
    let running = usdtBalance;
    for (let i = points.length - 1; i >= 0; i -= 1) {
      const point = points[i]!;
      point.balance = running;
      running -= point.mined - point.withdrawn;
    }
    return { usdtBalance, points };
  }

  async getTransactions(userId: string, query: WalletTransactionsQuery) {
    const result = await this.repo.listMergedTransactions(userId, query);
    return {
      items: result.items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      nextCursor: result.nextCursor,
      ledgerStartedAt: result.ledgerStartedAt,
    };
  }

  async recordUsdcEvent(
    wallet: string,
    type: 'usdc_deposit' | 'usdc_withdraw',
    amount: number,
    txHash: string,
    blockNumber?: bigint,
  ) {
    const user = await this.repo.findUserByWallet(wallet);
    if (!user) return null;

    const signedAmount = type === 'usdc_withdraw' ? -Math.abs(amount) : Math.abs(amount);
    return this.repo.upsertWalletTransaction({
      userId: user.id,
      type,
      amount: signedAmount,
      txHash: txHash.toLowerCase(),
      blockNumber,
    });
  }
}
