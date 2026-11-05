import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  ErrorCode,
  MgtTxType,
  type OfferwallRewardDTO,
  type ZeradsPtcDailyStatDTO,
  type ZeradsPtcStatsDTO,
} from '@mll/shared';
import { AppError } from '../../common/lib/errors.js';
import { applyMgtCredit } from '../wallet/mgt-ledger.js';
import { config } from '../../config/env.js';

const ZERADS_QUEST_ID = 'offerwall_zerads_ptc';
const ZERADS_LINE_INDEX = 0;
const FIVE_MIN_MS = 5 * 60_000;

interface OfferwallConfig {
  enabled: boolean;
  apiKey?: string;
  secretKey?: string;
  provider: string;
}

function getOfferwallConfig(): OfferwallConfig {
  return {
    enabled: process.env.OFFERWALL_ZERADS_ENABLED === 'true',
    apiKey: process.env.OFFERWALL_ZERADS_API_KEY,
    secretKey: process.env.OFFERWALL_ZERADS_SECRET_KEY,
    provider: 'zerads',
  };
}

/** Bucket de 5 min alinhado ao relógio (UTC), igual ao intervalo de callback do Zerads PTC. */
function ptcPeriodKey(now = new Date()): string {
  const bucketStart = Math.floor(now.getTime() / FIVE_MIN_MS) * FIVE_MIN_MS;
  return new Date(bucketStart).toISOString();
}

function utcDayKeyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export class OfferwallService {
  constructor(private readonly prisma: PrismaClient) {}

  async processReward(params: {
    userId: string;
    transactionId: string;
    amount: number;
    currency: string;
    userIp?: string;
    callbackRaw?: unknown;
  }): Promise<OfferwallRewardDTO> {
    const cfg = getOfferwallConfig();
    if (!cfg.enabled) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'offerwall_disabled' });
    }

    const existing = await this.prisma.offerwallReward.findUnique({
      where: { transactionId: params.transactionId },
    });

    if (existing) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 409, {
        reason: 'duplicate_transaction',
        existingStatus: existing.status,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const reward = await tx.offerwallReward.create({
        data: {
          userId: params.userId,
          provider: cfg.provider,
          transactionId: params.transactionId,
          amount: params.amount,
          currency: params.currency,
          userIp: params.userIp ?? null,
          callbackRaw: params.callbackRaw ? (params.callbackRaw as object) : undefined,
          status: 'completed',
        },
      });

      if (params.currency === 'GMT') {
        await applyMgtCredit(
          tx,
          params.userId,
          params.amount,
          MgtTxType.EVENT_REWARD,
          { source: 'offerwall_zerads', transactionId: params.transactionId },
        );
      } else if (params.currency === 'USDC') {
        await applyMgtCredit(
          tx,
          params.userId,
          params.amount,
          MgtTxType.EVENT_REWARD,
          { source: 'offerwall_zerads', transactionId: params.transactionId, currency: 'USDC' },
        );
      }

      return {
        id: String(reward.id),
        userId: String(reward.userId),
        provider: String(reward.provider),
        transactionId: String(reward.transactionId),
        amount: Number(reward.amount),
        currency: String(reward.currency),
        status: String(reward.status),
        createdAt: reward.createdAt.toISOString(),
      };
    });
  }

  async getRewards(userId: string): Promise<OfferwallRewardDTO[]> {
    const rewards = await this.prisma.offerwallReward.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return rewards.map((r) => ({
      id: String(r.id),
      userId: String(r.userId),
      provider: String(r.provider),
      transactionId: String(r.transactionId),
      amount: Number(r.amount),
      currency: String(r.currency),
      status: String(r.status),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async listAdminRewards(
    filters: { userId?: string; provider?: string; limit?: number },
  ): Promise<OfferwallRewardDTO[]> {
    const where: Record<string, unknown> = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.provider) where.provider = filters.provider;

    const rewards = await this.prisma.offerwallReward.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters.limit ?? 50, 200),
    });

    return rewards.map((r) => ({
      id: String(r.id),
      userId: String(r.userId),
      provider: String(r.provider),
      transactionId: String(r.transactionId),
      amount: Number(r.amount),
      currency: String(r.currency),
      status: String(r.status),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async reverseReward(transactionId: string): Promise<OfferwallRewardDTO> {
    const reward = await this.prisma.offerwallReward.findUnique({
      where: { transactionId },
    });

    if (!reward) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 404, { reason: 'reward_not_found' });
    }

    if (reward.status !== 'completed') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
        reason: 'cannot_reverse_non_completed',
        currentStatus: reward.status,
      });
    }

    const updated = await this.prisma.offerwallReward.update({
      where: { id: reward.id },
      data: { status: 'reversed' },
    });

    return {
      id: String(updated.id),
      userId: String(updated.userId),
      provider: String(updated.provider),
      transactionId: String(updated.transactionId),
      amount: Number(updated.amount),
      currency: String(updated.currency),
      status: String(updated.status),
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Callback PTC do Zerads (~a cada 5 min; `amount` = ZER e `clicks` = cliques reais
   * ganhos naquela janela — vêm prontos deles, não é 1 clique por callback).
   * Idempotência: constraint única (userId, periodKey) no ZeradsPtcCallback — um
   * callback duplicado/reenviado pra mesma janela de 5 min não credita nem conta de novo.
   */
  async processPtcCallback(params: {
    userId: string;
    zerAmount: number;
    clicks: number;
    now?: Date;
  }): Promise<{ granted: boolean; overwall: number }> {
    const now = params.now ?? new Date();
    if (params.zerAmount <= 0 && params.clicks <= 0) return { granted: false, overwall: 0 };

    const overwall = params.zerAmount > 0
      ? Math.max(1, Math.floor(params.zerAmount * config.OFFERWALL_ZERADS_ZER_TO_OW))
      : 0;
    const expiresAt = new Date(now.getTime() + config.OFFERWALL_ZERADS_OW_TTL_HOURS * 3_600_000);
    const periodKey = ptcPeriodKey(now);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.zeradsPtcCallback.create({
          data: {
            userId: params.userId,
            periodKey,
            zerAmount: params.zerAmount,
            clicks: Math.max(0, Math.floor(params.clicks)),
            overwall,
          },
        });

        if (overwall > 0) {
          await tx.eventOverwallGrant.create({
            data: {
              userId: params.userId,
              questId: ZERADS_QUEST_ID,
              periodKey,
              lineIndex: ZERADS_LINE_INDEX,
              amount: overwall,
              expiresAt,
            },
          });
        }
      });
      return { granted: overwall > 0, overwall };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Callback duplicado pra mesma janela de 5 min — no-op silencioso, sem erro pro Zerads.
        return { granted: false, overwall: 0 };
      }
      throw err;
    }
  }

  async getPtcStats(userId: string, now = new Date()): Promise<ZeradsPtcStatsDTO> {
    const since = new Date(now.getTime() - 14 * 86_400_000);
    const [recentCallbacks, activeAgg, lifetimeAgg] = await Promise.all([
      this.prisma.zeradsPtcCallback.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { zerAmount: true, clicks: true, overwall: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.eventOverwallGrant.aggregate({
        where: { userId, questId: ZERADS_QUEST_ID, expiresAt: { gt: now } },
        _sum: { amount: true },
      }),
      this.prisma.zeradsPtcCallback.aggregate({
        where: { userId },
        _sum: { overwall: true, clicks: true, zerAmount: true },
      }),
    ]);

    const byDay = new Map<string, { overwall: number; zer: number; clicks: number }>();
    for (const cb of recentCallbacks) {
      const key = utcDayKeyOf(cb.createdAt);
      const acc = byDay.get(key) ?? { overwall: 0, zer: 0, clicks: 0 };
      acc.overwall += cb.overwall;
      acc.zer += Number(cb.zerAmount);
      acc.clicks += cb.clicks;
      byDay.set(key, acc);
    }

    const daily: ZeradsPtcDailyStatDTO[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const day = utcDayKeyOf(new Date(now.getTime() - i * 86_400_000));
      const acc = byDay.get(day) ?? { overwall: 0, zer: 0, clicks: 0 };
      daily.push({
        day,
        overwall: acc.overwall,
        zer: Number(acc.zer.toFixed(4)),
        clicks: acc.clicks,
      });
    }

    const today = daily[daily.length - 1];

    return {
      todayOverwall: today.overwall,
      todayZer: today.zer,
      todayClicks: today.clicks,
      lifetimeOverwall: lifetimeAgg._sum.overwall ?? 0,
      lifetimeZer: Number((lifetimeAgg._sum.zerAmount ?? 0).toFixed(4)),
      lifetimeClicks: lifetimeAgg._sum.clicks ?? 0,
      activeOverwall: activeAgg._sum.amount ?? 0,
      daily,
    };
  }
}
