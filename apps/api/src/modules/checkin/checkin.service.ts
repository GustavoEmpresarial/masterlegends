import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type {
  CheckInClaimResultDTO,
  CheckInGrantItemDTO,
  CheckInStatusDTO,
  CheckInStreakRewardPreviewDTO,
} from '@mll/shared';
import {
  CHECKIN_MAX_ACTIVE_OVERWALL,
  CHECKIN_OVERWALL_AMOUNT,
  CHECKIN_STREAK_THRESHOLD_DEFAULT,
  checkInExpiresAt,
  countConsecutiveCheckInStreak,
  nextCheckInAvailableAt,
  utcDayStart,
} from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { MiningService } from '../mining/mining.service.js';
import { CheckInRepository } from './checkin.repository.js';

function mapGrant(
  grant: { id: string; amount: number; grantedAt: Date; expiresAt: Date },
  now = new Date(),
): CheckInGrantItemDTO {
  const msLeft = grant.expiresAt.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  return {
    id: grant.id,
    amount: grant.amount,
    grantedAt: grant.grantedAt.toISOString(),
    expiresAt: grant.expiresAt.toISOString(),
    daysLeft,
  };
}

export class CheckInService {
  private readonly repo: CheckInRepository;
  private readonly mining: MiningService;
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.repo = new CheckInRepository(prisma);
    this.mining = new MiningService(prisma);
  }

  /** Expõe bônus ativo para integração com mineração/ranking. */
  async getActiveOverwallForUser(userId: string, now = new Date()): Promise<number> {
    return this.repo.getActiveOverwallForUser(userId, now);
  }

  async loadActiveOverwallByUser(now = new Date()): Promise<Map<string, number>> {
    return this.repo.loadActiveOverwallByUser(now);
  }

  private async canClaimToday(userId: string, now = new Date()): Promise<boolean> {
    const claimedToday = await this.repo.hasCheckInForDay(userId, utcDayStart(now));
    return !claimedToday;
  }

  private async getStreakConfig(): Promise<{
    threshold: number;
    reward: CheckInStreakRewardPreviewDTO;
  }> {
    const cfg = await this.prisma.platformConfig.findUnique({
      where: { id: 'default' },
      select: {
        checkInStreakThreshold: true,
        checkInStreakPlayerName: true,
        checkInStreakPlayerImageUrl: true,
        checkInStreakPlayerOverwall: true,
        checkInStreakPlayerPosition: true,
        checkInStreakPlayerDays: true,
      },
    });
    return {
      threshold: cfg?.checkInStreakThreshold ?? CHECKIN_STREAK_THRESHOLD_DEFAULT,
      reward: {
        name: cfg?.checkInStreakPlayerName ?? 'Comum 1',
        imageUrl: cfg?.checkInStreakPlayerImageUrl ?? '/ui/bonecos/comum-1.png?v=1',
        overwall: cfg?.checkInStreakPlayerOverwall ?? 5,
        position: cfg?.checkInStreakPlayerPosition ?? 0,
        durationDays: cfg?.checkInStreakPlayerDays ?? 30,
      },
    };
  }

  private async computeStreak(userId: string, now: Date, streakTarget: number) {
    const days = await this.repo.findRecentCheckInDays(userId);
    const streak = countConsecutiveCheckInStreak(days, now);
    const rem = streak % streakTarget;
    const nextStreakRewardIn = streak === 0 ? streakTarget : rem === 0 ? 0 : streakTarget - rem;
    return { streak, streakTarget, nextStreakRewardIn };
  }

  async getStatus(userId: string): Promise<CheckInStatusDTO> {
    const now = new Date();
    const streakCfg = await this.getStreakConfig();
    const [lineupOverwall, activeGrants, canClaim, latest, streakInfo] = await Promise.all([
      this.mining.getLineupOverwall(userId),
      this.repo.findActiveGrantsForUser(userId, now),
      this.canClaimToday(userId, now),
      this.repo.findLatestCheckInDay(userId),
      this.computeStreak(userId, now, streakCfg.threshold),
    ]);

    const activeOverwall = activeGrants.reduce((sum, g) => sum + g.amount, 0);

    return {
      activeOverwall,
      maxActiveOverwall: CHECKIN_MAX_ACTIVE_OVERWALL,
      lineupOverwall,
      totalOverwall: lineupOverwall + activeOverwall,
      canClaimToday: canClaim,
      nextAvailableAt: canClaim ? null : nextCheckInAvailableAt(now).toISOString(),
      lastCheckInDay: latest?.checkInDay.toISOString() ?? null,
      grants: activeGrants.map((g) => mapGrant(g, now)),
      streak: streakInfo.streak,
      streakTarget: streakInfo.streakTarget,
      nextStreakRewardIn: streakInfo.nextStreakRewardIn,
      streakReward: streakCfg.reward,
    };
  }

  async claim(userId: string): Promise<CheckInClaimResultDTO> {
    const now = new Date();
    const canClaim = await this.canClaimToday(userId, now);
    if (!canClaim) {
      throw new AppError(ErrorCode.CHECKIN_ALREADY_CLAIMED, 409, {
        nextAvailableAt: nextCheckInAvailableAt(now).toISOString(),
      });
    }

    const grant = await this.createGrantSafe(userId, now);
    const streakCfg = await this.getStreakConfig();
    const streakInfo = await this.computeStreak(userId, now, streakCfg.threshold);
    const reward = await this.maybeGrantStreakReward(
      userId,
      streakInfo.streak,
      streakInfo.streakTarget,
      now,
      streakCfg.reward,
    );

    const [lineupOverwall, activeOverwall] = await Promise.all([
      this.mining.getLineupOverwall(userId),
      this.repo.getActiveOverwallForUser(userId, now),
    ]);

    return {
      grant: mapGrant(grant, now),
      activeOverwall,
      lineupOverwall,
      totalOverwall: lineupOverwall + activeOverwall,
      streak: streakInfo.streak,
      streakTarget: streakInfo.streakTarget,
      nextStreakRewardIn: streakInfo.nextStreakRewardIn,
      streakRewardGranted: reward.granted,
      streakRewardPlayerName: reward.playerName,
      streakReward: streakCfg.reward,
    };
  }

  /** Idempotente: unique (userId, checkInDay) impede claim duplicado em race. */
  private async createGrantSafe(userId: string, now: Date) {
    try {
      return await this.repo.createGrant({
        userId,
        amount: CHECKIN_OVERWALL_AMOUNT,
        checkInDay: utcDayStart(now),
        expiresAt: checkInExpiresAt(now),
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError(ErrorCode.CHECKIN_ALREADY_CLAIMED, 409, {
          nextAvailableAt: nextCheckInAvailableAt(now).toISOString(),
        });
      }
      throw err;
    }
  }

  private async maybeGrantStreakReward(
    userId: string,
    streak: number,
    threshold: number,
    now: Date,
    preview: CheckInStreakRewardPreviewDTO,
  ): Promise<{ granted: boolean; playerName: string | null }> {
    if (threshold <= 0 || streak <= 0 || streak % threshold !== 0) {
      return { granted: false, playerName: null };
    }

    const milestone = streak;
    if (await this.repo.hasStreakMilestone(userId, milestone)) {
      return { granted: false, playerName: null };
    }

    const expiresAt = new Date(now.getTime() + preview.durationDays * 24 * 60 * 60 * 1000);
    const checkInDay = utcDayStart(now);

    try {
      const player = await this.prisma.$transaction(async (tx) => {
        await tx.checkInStreakReward.create({
          data: {
            userId,
            milestone,
            checkInDay,
          },
        });

        const created = await tx.basePlayer.create({
          data: {
            userId,
            rarity: 0,
            overwall: preview.overwall,
            position: preview.position,
            name: preview.name,
            imageUrl: preview.imageUrl,
            source: 'checkin_streak',
            expiresAt,
          },
        });

        await tx.checkInStreakReward.update({
          where: { userId_milestone: { userId, milestone } },
          data: { playerId: created.id },
        });

        const agg = await tx.basePlayer.aggregate({
          where: { userId, retiredAt: null },
          _sum: { overwall: true },
        });
        await tx.club.updateMany({
          where: { userId },
          data: { totalOverwall: agg._sum.overwall ?? 0 },
        });

        return created;
      });

      return { granted: true, playerName: player.name };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { granted: false, playerName: null };
      }
      throw err;
    }
  }
}
