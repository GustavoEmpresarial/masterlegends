import type { PrismaClient } from '@prisma/client';
import type { PassMissionConfigDTO, PassMissionEvent } from '@mll/shared';
import { logger } from '../../common/lib/logger.js';
import {
  findConfiguredPassSeasons,
  type ConfiguredPassSeason,
} from './pass-season.service.js';

export interface MissionProgressRow {
  missionId: string;
  count: number;
  target: number;
  claimedAt: Date | null;
  expiresAt: Date;
  period: string;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function currentDailyPeriod(now: Date = new Date()): string {
  return `daily:${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
}

export function dailyExpiresAt(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** ISO-8601 week number. Sunday rolls into the prior week. */
export function currentWeeklyPeriod(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `weekly:${d.getUTCFullYear()}-W${pad2(week)}`;
}

export function weeklyExpiresAt(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  // ISO week ends on Sunday 23:59:59.999 UTC. We use start of next Monday as expiry.
  const daysUntilNextMonday = 8 - dayNum;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysUntilNextMonday));
}

interface MissionContext {
  season: ConfiguredPassSeason;
  mission: PassMissionConfigDTO;
  period: string;
  expiresAt: Date;
}

export class MissionProgressService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly onMissionComplete?: (
    userId: string,
    mission: PassMissionConfigDTO,
    seasonId: number,
  ) => Promise<void>,
  ) {}

  /**
   * Records `amount` units of an event for the given user, advancing every
   * matching mission in the active season. Awards mission XP on completion via
   * the `onMissionComplete` callback. Fire-and-forget at the callsite — never
   * throws (errors logged).
   */
  async incrementEvent(
    userId: string,
    eventType: PassMissionEvent,
    amount = 1,
  ): Promise<void> {
    if (amount <= 0) return;
    try {
      const seasons = await findConfiguredPassSeasons(this.prisma);
      if (seasons.length === 0) return;
      const now = new Date();
      for (const season of seasons) {
        const contexts = this.matchingMissions(season, eventType, now);
        for (const ctx of contexts) {
          await this.advanceOne(userId, ctx, amount);
        }
      }
    } catch (err) {
      logger.error({ err, userId, eventType }, 'mission progress increment failed');
    }
  }

  private matchingMissions(
    season: ConfiguredPassSeason,
    eventType: PassMissionEvent,
    now: Date,
  ): MissionContext[] {
    const out: MissionContext[] = [];
    for (const mission of season.missions) {
      if (mission.eventType !== eventType) continue;
      const period =
        mission.category === 'weekly' ? currentWeeklyPeriod(now) : currentDailyPeriod(now);
      const expiresAt =
        mission.category === 'weekly' ? weeklyExpiresAt(now) : dailyExpiresAt(now);
      out.push({ season, mission, period, expiresAt });
    }
    return out;
  }

  private async advanceOne(userId: string, ctx: MissionContext, amount: number): Promise<void> {
    const { season, mission, period, expiresAt } = ctx;
    const row = await this.prisma.missionProgress.upsert({
      where: {
        userId_seasonId_missionId_period: {
          userId,
          seasonId: season.id,
          missionId: mission.id,
          period,
        },
      },
      create: {
        userId,
        seasonId: season.id,
        missionId: mission.id,
        period,
        count: Math.min(amount, mission.target),
        target: mission.target,
        expiresAt,
      },
      update: {
        count: { increment: amount },
      },
    });

    // Clamp to target if we overshot.
    const finalCount = Math.min(row.count, mission.target);
    if (row.count > mission.target) {
      await this.prisma.missionProgress.update({
        where: { id: row.id },
        data: { count: finalCount },
      });
    }

    const justCompleted = !row.claimedAt && finalCount >= mission.target;
    if (justCompleted) {
      await this.prisma.missionProgress.update({
        where: { id: row.id },
        data: { claimedAt: new Date() },
      });
      try {
        await this.onMissionComplete?.(userId, mission, season.id);
      } catch (err) {
        logger.error({ err, userId, missionId: mission.id }, 'mission complete callback failed');
      }
    }
  }

  async listForUser(userId: string, now: Date = new Date(), seasonId?: number): Promise<MissionProgressRow[]> {
    const dailyPeriod = currentDailyPeriod(now);
    const weeklyPeriod = currentWeeklyPeriod(now);
    const rows = await this.prisma.missionProgress.findMany({
      where: {
        userId,
        ...(seasonId !== undefined ? { seasonId } : {}),
        period: { in: [dailyPeriod, weeklyPeriod] },
      },
    });
    return rows.map((r) => ({
      missionId: r.missionId,
      count: r.count,
      target: r.target,
      claimedAt: r.claimedAt,
      expiresAt: r.expiresAt,
      period: r.period,
    }));
  }
}
