import { calculatePassPremiumPricing } from './pass-premium-pricing.js';
import { claimPassReward } from './pass-reward.service.js';
import { PrismaClient } from '@prisma/client';
import { MgtTxType, findRankForLevel, findRewardBlockForLevel, parsePassRankConfig } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { applyMgtCredit, applyMgtDebit } from '../wallet/mgt-ledger.js';
import {
  findConfiguredPassSeason,
  findConfiguredPassSeasons,
  passLevelFromConfiguredXp,
  type ConfiguredPassSeason,
} from './pass-season.service.js';
import {
  MissionProgressService,
  type MissionProgressRow,
} from './mission-progress.service.js';

export class PassRepository {
  constructor(private readonly prisma: PrismaClient) {}

  claimConfiguredReward(userId: string, season: ConfiguredPassSeason, level: number) {
    return claimPassReward(this.prisma, userId, season, level);
  }

  findConfiguredSeason() {
    return findConfiguredPassSeason(this.prisma);
  }

  findConfiguredSeasons() {
    return findConfiguredPassSeasons(this.prisma);
  }

  findProgress(userId: string, seasonId: number) {
    return this.prisma.passProgress.findUnique({
      where: { userId_seasonId: { userId, seasonId } },
    });
  }

  upsertProgress(userId: string, seasonId: number, xpDelta: number) {
    return this.prisma.passProgress.upsert({
      where: { userId_seasonId: { userId, seasonId } },
      create: { userId, seasonId, xp: xpDelta },
      update: { xp: { increment: xpDelta } },
    });
  }

  async claimLevel(userId: string, seasonId: number, level: number) {
    return this.prisma.passProgress.update({
      where: { userId_seasonId: { userId, seasonId } },
      data: { claimedLevels: { push: level } },
    });
  }

  async setPremium(userId: string, seasonId: number) {
    return this.prisma.passProgress.update({
      where: { userId_seasonId: { userId, seasonId } },
      data: { premium: true },
    });
  }

  async purchasePremium(userId: string, seasonId: number) {
    return this.prisma.$transaction(async tx => {
      // Season, progress, charge and activation share one consistent transaction.
      await tx.$queryRaw`SELECT "id" FROM "Season" WHERE "id" = ${seasonId} FOR SHARE`;
      const seasons = await findConfiguredPassSeasons(tx);
      const season = seasons.find((entry) => entry.id === seasonId);
      if (!season) {
        throw new AppError(ErrorCode.PASS_NO_ACTIVE_SEASON, 400);
      }
      await tx.passProgress.upsert({
        where: { userId_seasonId: { userId, seasonId } },
        create: { userId, seasonId, xp: 0 },
        update: {},
      });
      await tx.$queryRaw`SELECT "userId" FROM "PassProgress" WHERE "userId" = ${userId} AND "seasonId" = ${seasonId} FOR UPDATE`;
      const progress = await tx.passProgress.findUniqueOrThrow({
        where: { userId_seasonId: { userId, seasonId } },
      });
      if (progress.premium) {
        throw new AppError(ErrorCode.PASS_ALREADY_PREMIUM, 400);
      }
      const pricing = calculatePassPremiumPricing(season.premiumPriceUsdc, progress.xp, season.levels);
      if (pricing.priceGmt > 0) {
        await applyMgtDebit(tx, userId, pricing.priceGmt, MgtTxType.PASS_PREMIUM, {
          seasonId,
          basePriceGmt: pricing.basePriceGmt,
          discountGmt: pricing.discountGmt,
          completedLevels: pricing.completedLevels,
          totalLevels: pricing.totalLevels,
        });
      }
      const passXp = Math.max(progress.xp, ...season.levels.map((level) => level.xpRequired));
      await tx.passProgress.update({
        where: { userId_seasonId: { userId, seasonId } },
        data: { premium: true, xp: passXp },
      });
      return pricing;
    }, { timeout: 15000 });
  }

  async creditMgt(userId: string, amount: number, level?: number) {
    await applyMgtCredit(this.prisma, userId, amount, MgtTxType.PASS_CLAIM, { level });
  }

  async debitMgt(userId: string, amount: number) {
    await applyMgtDebit(this.prisma, userId, amount, MgtTxType.PASS_PREMIUM);
  }
}

export class PassService {
  private readonly missionProgress: MissionProgressService;

  constructor(
    private readonly repo: PassRepository,
    private readonly prisma: PrismaClient,
  ) {
    // Wire mission completion → award XP (which may further propagate via escolinha,
    // injected externally by callers that wrap addXp).
    this.missionProgress = new MissionProgressService(prisma, async (uid, mission, seasonId) => {
      await this.repo.upsertProgress(uid, seasonId, mission.xp);
    });
  }

  getMissionProgressService(): MissionProgressService {
    return this.missionProgress;
  }

  private async formatProgress(
    userId: string,
    xp: number,
    premium: boolean,
    claimedLevels: number[],
    season: ConfiguredPassSeason | null,
  ) {
    const emptyRank = {
      rank: 'bronze' as const,
      bonusPct: 0,
      minLevel: 1,
      maxLevel: 10,
    };
    if (!season) {
      return {
        active: false,
        xp: 0,
        level: 0,
        premium: false,
        claimedLevels: [] as number[],
        seasonId: null,
        seasonName: null,
        seasonEndsAt: null,
        premiumPriceUsdc: 0,
        premiumPricing: null,
        levels: [],
        missions: [],
        dailyMissions: [],
        weeklyMissions: [],
        rank: emptyRank,
      };
    }

    const level = passLevelFromConfiguredXp(xp, season.levels);
    const levels = season.levels.map((entry) => {
      const reward = findRewardBlockForLevel(entry.level, season.rewardBlocks) ?? entry;
      return ({
      level: entry.level,
      xpRequired: entry.xpRequired,
      rewardLabel: reward.rewardLabel,
      rewardType: reward.rewardType,
      rewardImageUrl: reward.rewardImageUrl ?? null,
      quantity: reward.quantity ?? 1,
      claimed: claimedLevels.includes(entry.level),
      locked: !premium && xp < entry.xpRequired,
    }); });

    const progressRows: MissionProgressRow[] = await this.missionProgress.listForUser(userId, new Date(), season.id);
    const byMissionId = new Map<string, MissionProgressRow>();
    for (const r of progressRows) {
      const key = `${r.period}|${r.missionId}`;
      byMissionId.set(key, r);
    }

    const now = new Date();
    const { currentDailyPeriod, currentWeeklyPeriod, dailyExpiresAt, weeklyExpiresAt } = await import(
      './mission-progress.service.js'
    );
    const dailyPeriod = currentDailyPeriod(now);
    const weeklyPeriod = currentWeeklyPeriod(now);
    const dailyExp = dailyExpiresAt(now).toISOString();
    const weeklyExp = weeklyExpiresAt(now).toISOString();

    const missions = season.missions.map((m) => {
      const period = m.category === 'weekly' ? weeklyPeriod : dailyPeriod;
      const expiresAt = m.category === 'weekly' ? weeklyExp : dailyExp;
      const row = byMissionId.get(`${period}|${m.id}`);
      return {
        id: m.id,
        label: m.label,
        progress: Math.min(row?.count ?? 0, m.target),
        target: m.target,
        xp: m.xp,
        category: m.category,
        difficulty: m.difficulty,
        eventType: m.eventType,
        period,
        expiresAt,
        claimed: !!row?.claimedAt,
      };
    });

    const dailyMissions = missions.filter((m) => m.category === 'daily');
    const weeklyMissions = missions.filter((m) => m.category === 'weekly');

    const rankCfgRow = await this.prisma.platformConfig.findUnique({
      where: { id: 'default' },
      select: { passRankConfig: true },
    });
    const rankCfg = parsePassRankConfig(rankCfgRow?.passRankConfig);
    const rank = findRankForLevel(level, rankCfg);

    return {
      active: true,
      xp,
      level,
      premium,
      claimedLevels,
      seasonId: season.id,
      seasonName: season.name,
      seasonEndsAt: season.endsAt.toISOString(),
      premiumPriceUsdc: season.premiumPriceUsdc,
      premiumPricing: calculatePassPremiumPricing(season.premiumPriceUsdc, xp, season.levels),
      levels,
      missions,
      dailyMissions,
      weeklyMissions,
      rank: {
        rank: rank.rank,
        bonusPct: rank.bonusPct,
        minLevel: rank.minLevel,
        maxLevel: rank.maxLevel,
      },
    };
  }

  async getProgress(userId: string) {
    const seasons = await this.repo.findConfiguredSeasons();
    if (seasons.length === 0) {
      return this.formatProgress(userId, 0, false, [], null);
    }

    const passes = [];
    for (const season of seasons) {
      const progress = await this.repo.findProgress(userId, season.id);
      passes.push(await this.formatProgress(
        userId,
        progress?.xp ?? 0,
        progress?.premium ?? false,
        progress?.claimedLevels ?? [],
        season,
      ));
    }
    return { ...passes[0], passes };
  }

  async addXp(userId: string, amount: number) {
    if (amount <= 0) return;
    const seasons = await this.repo.findConfiguredSeasons();
    for (const season of seasons) {
      await this.repo.upsertProgress(userId, season.id, amount);
    }
  }

  private async seasonForAction(seasonId?: number): Promise<ConfiguredPassSeason> {
    const seasons = await this.repo.findConfiguredSeasons();
    const season = seasonId == null ? seasons[0] : seasons.find((entry) => entry.id === seasonId);
    if (!season) {
      throw new AppError(ErrorCode.PASS_NO_ACTIVE_SEASON, 400);
    }
    return season;
  }

  async claim(userId: string, level: number, seasonId?: number) {
    const season = await this.seasonForAction(seasonId);

    await this.repo.claimConfiguredReward(userId, season, level);

    // Mission hook: claiming a pass reward counts as `pass_claim`.
    void this.missionProgress.incrementEvent(userId, 'pass_claim', 1);
    void import('../events/quest-progress.service.js').then(({ QuestProgressService }) =>
      new QuestProgressService(this.prisma).incrementTrigger(userId, 'pass_claim', 1),
    );

    return this.getProgress(userId);
  }

  async buyPremium(userId: string, seasonId?: number) {
    const season = await this.seasonForAction(seasonId);

    await this.repo.purchasePremium(userId, season.id);
    return this.getProgress(userId);
  }
}
