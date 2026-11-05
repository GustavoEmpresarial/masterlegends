import type { PrismaClient, QuestDefinition } from '@prisma/client';
import { QuestKind, QuestPeriod, QuestTrigger } from '@mll/shared';
import { runWithSystemContext } from '../../src/common/lib/prisma-context.js';

let seq = 0;

export type CreateQuestOpts = {
  title?: string;
  trigger?: string;
  target?: number;
  rewards?: unknown;
  active?: boolean;
  period?: string;
  kind?: string;
  maxClaimsPerUser?: number;
  maxGlobalClaims?: number | null;
  requireEmailVerified?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  campaignId?: string | null;
};

export async function createTestQuest(
  prisma: PrismaClient,
  opts: CreateQuestOpts = {},
): Promise<QuestDefinition> {
  seq += 1;
  return runWithSystemContext(async () =>
    prisma.questDefinition.create({
      data: {
        kind: opts.kind ?? QuestKind.EVENT_TASK,
        title: opts.title ?? `Quest Factory ${seq}`,
        description: 'factory quest',
        trigger: opts.trigger ?? QuestTrigger.LOGIN,
        target: opts.target ?? 1,
        rewards: (opts.rewards ?? [{ type: 'gmt', amount: 10 }]) as object,
        active: opts.active ?? true,
        period: opts.period ?? QuestPeriod.NONE,
        maxClaimsPerUser: opts.maxClaimsPerUser ?? 1,
        maxGlobalClaims: opts.maxGlobalClaims === undefined ? null : opts.maxGlobalClaims,
        requireEmailVerified: opts.requireEmailVerified ?? true,
        startsAt: opts.startsAt === undefined ? new Date(Date.now() - 86_400_000) : opts.startsAt,
        endsAt: opts.endsAt === undefined ? new Date(Date.now() + 86_400_000) : opts.endsAt,
        campaignId: opts.campaignId ?? null,
      },
    }),
  );
}

export async function createTestQuestProgress(
  prisma: PrismaClient,
  opts: { userId: string; questId: string; periodKey?: string; count: number; target: number },
) {
  return runWithSystemContext(async () =>
    prisma.questProgress.create({
      data: {
        userId: opts.userId,
        questId: opts.questId,
        periodKey: opts.periodKey ?? 'once',
        count: opts.count,
        target: opts.target,
        completedAt: opts.count >= opts.target ? new Date() : null,
      },
    }),
  );
}

export async function truncateEventTables(prisma: PrismaClient): Promise<void> {
  await runWithSystemContext(async () => {
    await prisma.questClaimLog.deleteMany();
    await prisma.questClaim.deleteMany();
    await prisma.questProgress.deleteMany();
    await prisma.eventOverwallGrant.deleteMany();
    await prisma.eventTriggerCooldown.deleteMany();
    await prisma.userBadge.deleteMany();
    await prisma.eventBadge.deleteMany();
    await prisma.questDefinition.deleteMany();
    await prisma.eventCampaign.deleteMany();
  });
}
