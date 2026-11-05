import type { PrismaClient } from '@prisma/client';
import type { AdminOverviewDTO } from '@mll/shared';
import { WithdrawalRequestService } from '../wallet/withdrawal-request.service.js';

export class AdminOverviewService {
  private readonly withdrawals: WithdrawalRequestService;

  constructor(private readonly prisma: PrismaClient) {
    this.withdrawals = new WithdrawalRequestService(prisma);
  }

  async getOverview(): Promise<AdminOverviewDTO> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      bannedUsers,
      newUsersToday,
      newUsers7d,
      pendingWithdrawals,
      openTickets,
      depositsToday,
      withdrawalsToday,
      deposits7d,
      withdrawals7d,
      totalUsdcRows,
      lastMiningBlock,
      totalMiningBlocks,
      miningCfg,
      totalReferrals,
      referrals7d,
      totalMints,
      mints7d,
      usersWithLineup,
      activePasses,
      withdrawalsCard,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { bannedAt: { not: null } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.user.count({ where: { createdAt: { gte: start7d } } }),
      this.prisma.withdrawalRequest.count({ where: { status: 'pending' } }),
      this.prisma.supportTicket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
      this.prisma.walletTransaction.findMany({
        where: { type: 'usdc_deposit', createdAt: { gte: startOfDay } },
        select: { amount: true },
      }),
      this.prisma.walletTransaction.findMany({
        where: { type: 'usdc_withdraw', createdAt: { gte: startOfDay } },
        select: { amount: true },
      }),
      this.prisma.walletTransaction.findMany({
        where: { type: 'usdc_deposit', createdAt: { gte: start7d } },
        select: { amount: true },
      }),
      this.prisma.walletTransaction.findMany({
        where: { type: 'usdc_withdraw', createdAt: { gte: start7d } },
        select: { amount: true },
      }),
      this.prisma.mGTBalance.aggregate({ _sum: { usdcAmount: true } }),
      this.prisma.miningBlock.findFirst({ orderBy: { blockNumber: 'desc' } }),
      this.prisma.miningBlock.count(),
      this.prisma.platformConfig.findUnique({ where: { id: 'default' }, select: { miningPaused: true } }),
      this.prisma.referral.count(),
      this.prisma.referral.count({ where: { createdAt: { gte: start7d } } }),
      this.prisma.basePlayer.count(),
      this.prisma.basePlayer.count({ where: { createdAt: { gte: start7d } } }),
      this.prisma.clubLineup.count(),
      this.prisma.passProgress.count({ where: { premium: true } }),
      this.withdrawals.overviewCard(),
    ]);

    return {
      totalUsers,
      bannedUsers,
      newUsersToday,
      newUsers7d,
      usersWithLineup,
      depositsTodayUsdc: depositsToday.reduce((s, r) => s + Math.abs(Number(r.amount)), 0),
      withdrawalsTodayUsdc: withdrawalsToday.reduce((s, r) => s + Math.abs(Number(r.amount)), 0),
      deposits7dUsdc: deposits7d.reduce((s, r) => s + Math.abs(Number(r.amount)), 0),
      withdrawals7dUsdc: withdrawals7d.reduce((s, r) => s + Math.abs(Number(r.amount)), 0),
      totalUsdcInGame: Math.abs(Number(totalUsdcRows._sum.usdcAmount ?? 0)),
      pendingWithdrawals,
      withdrawalsCard,
      lastMiningBlockNumber: lastMiningBlock ? Number(lastMiningBlock.blockNumber) : null,
      lastMiningBlockAt: lastMiningBlock?.minedAt.toISOString() ?? null,
      miningParticipantsLastBlock: lastMiningBlock?.participantCount ?? 0,
      totalMiningBlocksAllTime: totalMiningBlocks,
      miningPaused: miningCfg?.miningPaused ?? false,
      openTickets,
      totalReferrals,
      referrals7d,
      totalMints,
      mints7d,
      activePasses,
    };
  }
}
