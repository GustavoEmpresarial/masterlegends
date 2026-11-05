import type { PrismaClient } from '@prisma/client';
import type { AdminReferralCommissionDTO, AdminReferralCommissionsOverviewDTO } from '@mll/shared';

export class AdminReferralsService {
  constructor(private readonly prisma: PrismaClient) {}

  async overview() {
    const [totalReferrals, sumAgg, topReferrers] = await Promise.all([
      this.prisma.referral.count(),
      this.prisma.referral.aggregate({ _sum: { totalEarnedMGT: true } }),
      this.prisma.referral.groupBy({
        by: ['referrerId'],
        _count: { referrerId: true },
        _sum: { totalEarnedMGT: true },
        orderBy: { _sum: { totalEarnedMGT: 'desc' } },
        take: 10,
      }),
    ]);

    const referrerIds = topReferrers.map((r) => r.referrerId);
    const users =
      referrerIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: referrerIds } },
            select: { id: true, email: true, username: true, referralCode: true },
          })
        : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    return {
      totals: {
        totalReferrals,
        totalEarnedMgt: Number(sumAgg._sum.totalEarnedMGT ?? 0),
      },
      topReferrers: topReferrers.map((r) => {
        const u = userById.get(r.referrerId);
        return {
          referrerId: r.referrerId,
          username: u?.username ?? null,
          email: u?.email ?? null,
          referralCode: u?.referralCode ?? null,
          referralsCount: r._count.referrerId,
          totalEarnedMgt: Number(r._sum.totalEarnedMGT ?? 0),
        };
      }),
    };
  }

  async list(filter: { search?: string; limit?: number; cursor?: string } = {}) {
    const take = Math.min(100, Math.max(1, filter.limit ?? 50));
    const rows = await this.prisma.referral.findMany({
      take: take + 1,
      ...(filter.cursor ? { cursor: { referredId: filter.cursor }, skip: 1 } : {}),
      where: filter.search
        ? {
            OR: [
              { referrer: { email: { contains: filter.search, mode: 'insensitive' } } },
              { referrer: { username: { contains: filter.search, mode: 'insensitive' } } },
              { referred: { email: { contains: filter.search, mode: 'insensitive' } } },
              { referred: { username: { contains: filter.search, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        referrer: { select: { username: true, email: true, referralCode: true } },
        referred: { select: { username: true, email: true } },
      },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items: items.map((r) => ({
        referrerId: r.referrerId,
        referrerLabel: r.referrer.username ?? r.referrer.email ?? r.referrerId.slice(0, 8),
        referrerCode: r.referrer.referralCode,
        referredId: r.referredId,
        referredLabel: r.referred.username ?? r.referred.email ?? r.referredId.slice(0, 8),
        totalEarnedMgt: Number(r.totalEarnedMGT),
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? items[items.length - 1].referredId : null,
    };
  }

  async commissions(filter: {
    referrerId?: string;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ items: AdminReferralCommissionDTO[]; nextCursor: string | null }> {
    const take = Math.min(100, Math.max(1, filter.limit ?? 50));

    const where = {
      ...(filter.referrerId ? { referrerId: filter.referrerId } : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: new Date(filter.from) } : {}),
              ...(filter.to ? { lte: new Date(filter.to) } : {}),
            },
          }
        : {}),
    };

    const rows = await this.prisma.referralCommission.findMany({
      take: take + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        referrer: { select: { username: true, email: true } },
        referred: { select: { username: true, email: true } },
      },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const label = (username: string | null, email: string | null, id: string) =>
      username ?? email ?? id.slice(0, 8);

    return {
      items: items.map((r) => {
        const commission = Number(r.commissionAmount);
        return {
          id: r.id,
          referrerId: r.referrerId,
          referrerLabel: label(r.referrer.username, r.referrer.email, r.referrerId),
          referredId: r.referredId,
          referredLabel: label(r.referred.username, r.referred.email, r.referredId),
          sourceAmountUsdc: Number(r.grossAmount),
          commissionGmt: commission,
          commissionUsdc: commission,
          status: r.status,
          txHash: r.purchaseType === 'usdc_deposit' ? r.purchaseRef : null,
          createdAt: r.createdAt.toISOString(),
        };
      }),
      nextCursor: hasMore ? items[items.length - 1]!.id : null,
    };
  }

  async commissionsOverview(referrerId?: string): Promise<AdminReferralCommissionsOverviewDTO> {
    const where = {
      status: 'credited',
      ...(referrerId ? { referrerId } : {}),
    };

    const rows = await this.prisma.referralCommission.findMany({
      where,
      select: { referrerId: true, grossAmount: true, commissionAmount: true },
    });

    const byReferrerMap = new Map<string, { totalGmt: number; totalUsdc: number; count: number }>();
    let totalDepositedUsdc = 0;
    let totalCommission = 0;
    for (const row of rows) {
      const usdc = Number(row.grossAmount);
      const commission = Number(row.commissionAmount);
      totalDepositedUsdc += usdc;
      totalCommission += commission;
      const existing = byReferrerMap.get(row.referrerId) ?? { totalGmt: 0, totalUsdc: 0, count: 0 };
      byReferrerMap.set(row.referrerId, {
        totalGmt: existing.totalGmt + commission,
        totalUsdc: existing.totalUsdc + usdc,
        count: existing.count + 1,
      });
    }

    const referrerIds = [...byReferrerMap.keys()];
    const users = referrerIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: referrerIds } },
          select: { id: true, username: true, email: true, referralCode: true },
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    const byReferrer = referrerIds
      .map((id) => {
        const stats = byReferrerMap.get(id)!;
        const u = userById.get(id);
        return {
          referrerId: id,
          referrerLabel: u?.username ?? u?.email ?? id.slice(0, 8),
          referrerCode: u?.referralCode ?? null,
          eventsCount: stats.count,
          totalDepositedUsdc: stats.totalUsdc,
          totalCommissionGmt: stats.totalGmt,
        };
      })
      .sort((a, b) => b.totalCommissionGmt - a.totalCommissionGmt);

    return {
      totalCommissionsGmt: totalCommission,
      totalDepositedUsdc,
      totalEvents: rows.length,
      byReferrer,
    };
  }
}
