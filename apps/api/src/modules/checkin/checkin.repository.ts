import type { PrismaClient } from '@prisma/client';
import { sumActiveCheckInGrants, type CheckInGrantRow } from '@mll/shared';

export class CheckInRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveGrantsForUser(userId: string, now = new Date()) {
    return this.prisma.checkInGrant.findMany({
      where: { userId, expiresAt: { gt: now } },
      orderBy: { expiresAt: 'asc' },
    });
  }

  async findAllActiveGrantRows(now = new Date()): Promise<CheckInGrantRow[]> {
    return this.prisma.checkInGrant.findMany({
      where: { expiresAt: { gt: now } },
      select: { userId: true, amount: true, expiresAt: true },
    });
  }

  async getActiveOverwallForUser(userId: string, now = new Date()): Promise<number> {
    const [checkInAgg, eventAgg] = await Promise.all([
      this.prisma.checkInGrant.aggregate({
        where: { userId, expiresAt: { gt: now } },
        _sum: { amount: true },
      }),
      this.prisma.eventOverwallGrant.aggregate({
        where: { userId, expiresAt: { gt: now } },
        _sum: { amount: true },
      }),
    ]);
    return (checkInAgg._sum.amount ?? 0) + (eventAgg._sum.amount ?? 0);
  }

  async loadActiveOverwallByUser(now = new Date()): Promise<Map<string, number>> {
    const [checkInRows, eventRows] = await Promise.all([
      this.findAllActiveGrantRows(now),
      this.prisma.eventOverwallGrant.findMany({
        where: { expiresAt: { gt: now } },
        select: { userId: true, amount: true, expiresAt: true },
      }),
    ]);
    const map = sumActiveCheckInGrants(checkInRows, now);
    for (const row of eventRows) {
      map.set(row.userId, (map.get(row.userId) ?? 0) + row.amount);
    }
    return map;
  }

  async findLatestCheckInDay(userId: string) {
    return this.prisma.checkInGrant.findFirst({
      where: { userId },
      orderBy: { checkInDay: 'desc' },
      select: { checkInDay: true },
    });
  }

  /**
   * Checa "já fez check-in hoje" via lookup exato no índice único (userId, checkInDay),
   * em vez de reconstruir/comparar Date em JS a partir da última linha — evita falso
   * "ainda não fiz" no meio do dia por qualquer diferença de fuso na reconstrução do Date.
   */
  async hasCheckInForDay(userId: string, day: Date): Promise<boolean> {
    const row = await this.prisma.checkInGrant.findUnique({
      where: { userId_checkInDay: { userId, checkInDay: day } },
      select: { id: true },
    });
    return Boolean(row);
  }

  /** Recent check-in days for streak (newest first), capped for performance. */
  async findRecentCheckInDays(userId: string, take = 120): Promise<Date[]> {
    const rows = await this.prisma.checkInGrant.findMany({
      where: { userId },
      orderBy: { checkInDay: 'desc' },
      take,
      select: { checkInDay: true },
    });
    return rows.map((r) => r.checkInDay);
  }

  async createGrant(data: {
    userId: string;
    amount: number;
    checkInDay: Date;
    expiresAt: Date;
  }) {
    return this.prisma.checkInGrant.create({ data });
  }

  async hasStreakMilestone(userId: string, milestone: number): Promise<boolean> {
    const row = await this.prisma.checkInStreakReward.findUnique({
      where: { userId_milestone: { userId, milestone } },
      select: { id: true },
    });
    return Boolean(row);
  }
}
