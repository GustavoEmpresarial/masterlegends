import { randomUUID } from 'node:crypto';
import type { PrismaClient, QuestDefinition } from '@prisma/client';
import { QuestTrigger } from '@mll/shared';
import { logger } from '../../common/lib/logger.js';
import { isWithinWindow, periodKeyFor } from './period.js';

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export class QuestProgressService {
  constructor(private readonly prisma: PrismaClient) {}

  async incrementTrigger(userId: string, trigger: string, amount = 1): Promise<void> {
    if (amount <= 0) return;
    try {
      if (trigger === QuestTrigger.MARKET_VISIT) {
        const allowed = await this.consumeMarketVisitCooldown(userId);
        if (!allowed) return;
      }

      const now = new Date();
      const quests = await this.prisma.questDefinition.findMany({
        where: { active: true, trigger },
        include: { campaign: true },
      });

      for (const quest of quests) {
        if (!this.isQuestLive(quest, now)) continue;
        const periodKey = periodKeyFor(quest.period, now);
        await this.advanceOne(userId, quest, periodKey, amount);
      }
    } catch (err) {
      logger.error({ err, userId, trigger }, 'quest progress increment failed');
    }
  }

  /** market_visit: at most one progress bump per user per UTC day. */
  private async consumeMarketVisitCooldown(userId: string): Promise<boolean> {
    const dayKey = utcDayKey();
    try {
      await this.prisma.eventTriggerCooldown.create({
        data: {
          userId,
          trigger: QuestTrigger.MARKET_VISIT,
          dayKey,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  private isQuestLive(
    quest: QuestDefinition & {
      campaign: { active: boolean; startsAt: Date; endsAt: Date } | null;
    },
    now: Date,
  ): boolean {
    if (!isWithinWindow(quest.startsAt, quest.endsAt, now)) return false;
    if (quest.campaignId && quest.campaign) {
      if (!quest.campaign.active) return false;
      if (!isWithinWindow(quest.campaign.startsAt, quest.campaign.endsAt, now)) return false;
    }
    return true;
  }

  private async advanceOne(
    userId: string,
    quest: QuestDefinition,
    periodKey: string,
    amount: number,
  ) {
    const id = randomUUID();
    const target = quest.target;
    // Atomic increment — avoids lost updates under concurrent bumps.
    await this.prisma.$executeRaw`
      INSERT INTO "QuestProgress" (
        id, "userId", "questId", "periodKey", count, target, "completedAt", "createdAt", "updatedAt"
      )
      VALUES (
        ${id},
        ${userId},
        ${quest.id},
        ${periodKey},
        LEAST(${target}, ${amount}),
        ${target},
        CASE WHEN ${amount} >= ${target} THEN NOW() ELSE NULL END,
        NOW(),
        NOW()
      )
      ON CONFLICT ("userId", "questId", "periodKey") DO UPDATE SET
        count = LEAST(${target}, "QuestProgress".count + ${amount}),
        target = ${target},
        "completedAt" = CASE
          WHEN "QuestProgress"."completedAt" IS NOT NULL THEN "QuestProgress"."completedAt"
          WHEN LEAST(${target}, "QuestProgress".count + ${amount}) >= ${target} THEN NOW()
          ELSE NULL
        END,
        "updatedAt" = NOW()
      WHERE "QuestProgress"."completedAt" IS NULL
    `;
  }
}
