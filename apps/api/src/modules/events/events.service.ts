import type { PrismaClient } from '@prisma/client';
import { QuestKind, type QuestReward, questRewardSchema } from '@mll/shared';
import { isWithinWindow, periodKeyFor } from './period.js';
import { QuestClaimService } from './quest-claim.service.js';
import { QuestProgressService } from './quest-progress.service.js';

function parseRewards(raw: unknown): QuestReward[] {
  const r = questRewardSchema.array().safeParse(raw);
  return r.success ? r.data : [];
}

export class EventsService {
  readonly progress: QuestProgressService;
  readonly claims: QuestClaimService;

  constructor(private readonly prisma: PrismaClient) {
    this.progress = new QuestProgressService(prisma);
    this.claims = new QuestClaimService(prisma);
  }

  async getPlayerBoard(userId: string) {
    const now = new Date();
    const [campaigns, quests, badges, userBadges] = await Promise.all([
      this.prisma.eventCampaign.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { startsAt: 'desc' }],
      }),
      this.prisma.questDefinition.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.eventBadge.findMany({ orderBy: { title: 'asc' } }),
      this.prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true },
      }),
    ]);

    const liveCampaigns = campaigns.filter((c) =>
      isWithinWindow(c.startsAt, c.endsAt, now),
    );
    const liveQuests = quests.filter((q) => {
      if (!isWithinWindow(q.startsAt, q.endsAt, now)) return false;
      if (q.campaignId) {
        const camp = campaigns.find((c) => c.id === q.campaignId);
        if (!camp || !camp.active || !isWithinWindow(camp.startsAt, camp.endsAt, now)) {
          return false;
        }
      }
      return true;
    });

    const progressRows = await this.prisma.questProgress.findMany({
      where: {
        userId,
        questId: { in: liveQuests.map((q) => q.id) },
      },
    });
    const claimRows = await this.prisma.questClaim.findMany({
      where: {
        userId,
        questId: { in: liveQuests.map((q) => q.id) },
      },
    });

    const mapQuest = (q: (typeof liveQuests)[number]) => {
      const periodKey = periodKeyFor(q.period, now);
      const progress = progressRows.find(
        (p) => p.questId === q.id && p.periodKey === periodKey,
      );
      const claim =
        q.period === 'none'
          ? claimRows.find((c) => c.questId === q.id)
          : claimRows.find((c) => c.questId === q.id && c.periodKey === periodKey);
      const claimed = Boolean(claim);
      const userClaimsForCap =
        q.period === 'none'
          ? claimRows.filter((c) => c.questId === q.id).length
          : claimRows.filter((c) => c.questId === q.id && c.periodKey === periodKey).length;
      const count = progress?.count ?? 0;
      return {
        id: q.id,
        kind: q.kind,
        campaignId: q.campaignId,
        title: q.title,
        description: q.description,
        trigger: q.trigger,
        target: q.target,
        period: q.period,
        periodKey,
        rewards: parseRewards(q.rewards),
        count,
        completed: count >= q.target,
        claimed,
        claimedAt: claim?.claimedAt.toISOString() ?? null,
        canClaim: count >= q.target && !claimed && userClaimsForCap < q.maxClaimsPerUser,
        maxClaimsPerUser: q.maxClaimsPerUser,
        userClaims: userClaimsForCap,
        startsAt: q.startsAt?.toISOString() ?? null,
        endsAt: q.endsAt?.toISOString() ?? null,
        sortOrder: q.sortOrder,
      };
    };

    const questDtos = liveQuests.map(mapQuest);

    return {
      campaigns: liveCampaigns.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        body: c.body,
        imageUrl: c.imageUrl,
        startsAt: c.startsAt.toISOString(),
        endsAt: c.endsAt.toISOString(),
        sortOrder: c.sortOrder,
        quests: questDtos.filter(
          (q) => q.campaignId === c.id && q.kind !== QuestKind.ACHIEVEMENT,
        ),
      })),
      tasks: questDtos.filter(
        (q) =>
          (q.kind === QuestKind.DAILY_TASK || q.kind === QuestKind.WEEKLY_TASK) &&
          !q.campaignId,
      ),
      achievements: questDtos.filter((q) => q.kind === QuestKind.ACHIEVEMENT),
      eventTasks: questDtos.filter((q) => q.kind === QuestKind.EVENT_TASK && !q.campaignId),
      badges: badges.map((b) => ({
        id: b.id,
        code: b.code,
        title: b.title,
        iconUrl: b.iconUrl,
        unlocked: userBadges.some((ub) => ub.badgeId === b.id),
        unlockedAt:
          userBadges.find((ub) => ub.badgeId === b.id)?.unlockedAt.toISOString() ?? null,
      })),
    };
  }
}
