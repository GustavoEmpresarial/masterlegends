import { PrismaClient } from '@prisma/client';

export class ReferralsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByReferrerId(referrerId: string) {
    return this.prisma.referral.findMany({ where: { referrerId } });
  }

  async findDetailsByReferrerId(referrerId: string) {
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId },
      include: {
        referred: {
          select: { id: true, username: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const referredIds = referrals.map((r) => r.referredId);
    const deposits = referredIds.length === 0
      ? []
      : await this.prisma.walletTransaction.groupBy({
      by: ['userId'],
      where: { userId: { in: referredIds }, type: 'usdc_deposit', status: 'confirmed' },
      _count: { id: true },
      _sum: { amount: true },
    });

    const depositMap = new Map(
      deposits.map((d) => [d.userId, { count: d._count.id, totalUsdc: Number(d._sum.amount ?? 0) }]),
    );

    const [commissions, cfg] = await Promise.all([
      this.prisma.referralCommission.findMany({
        where: { referrerId },
        include: { referred: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.platformConfig.findUnique({
        where: { id: 'default' },
        select: { referralBonusPct: true },
      }),
    ]);

    const credited = commissions.filter((row) => row.status === 'credited');
    const earnedByReferred = new Map<string, number>();
    for (const row of credited) {
      earnedByReferred.set(
        row.referredId,
        (earnedByReferred.get(row.referredId) ?? 0) + Number(row.commissionAmount),
      );
    }

    return {
      bonusPct: cfg ? Number(cfg.referralBonusPct) : 0.05,
      referrals: referrals.map((r) => ({
        referredId: r.referredId,
        username: r.referred.username,
        joinedAt: r.referred.createdAt.toISOString(),
        referredAt: r.createdAt.toISOString(),
        totalEarnedUsdc: earnedByReferred.get(r.referredId) ?? 0,
        depositCount: depositMap.get(r.referredId)?.count ?? 0,
        totalDepositedUsdc: depositMap.get(r.referredId)?.totalUsdc ?? 0,
      })),
      commissions: commissions.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        referredId: row.referredId,
        username: row.referred.username,
        purchaseRef: row.purchaseType === 'usdc_deposit' ? row.purchaseRef : null,
        grossAmount: Number(row.grossAmount),
        commissionAmount: Number(row.commissionAmount),
        currency: row.currency,
        status: row.status,
        reason: commissionReason(row.history),
      })),
    };
  }
}

function commissionReason(history: unknown): string | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  const last = history[history.length - 1] as { reason?: unknown };
  return typeof last?.reason === 'string' ? last.reason : null;
}
