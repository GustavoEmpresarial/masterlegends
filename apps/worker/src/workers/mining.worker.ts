import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  MgtTxType,
  STADIUM_WATCH_OFFLINE_CUT,
  STADIUM_WATCH_OFFLINE_RATE,
  STADIUM_WATCH_ONLINE_RATE,
  splitFeeRate,
  splitPool,
  stadiumWatchKey,
} from '@mll/shared';
import type { Logger } from 'pino';
import { applyUsdtCredit, applyUsdtDebit } from '../lib/mgt-ledger.js';
import { loadLineupPowerByUser } from '../lib/lineup-power.js';
import { attributeMiningRoiAndRetire } from '../lib/player-roi.js';

/** Enough headroom for ~500 participants (sequential credits inside one tx). */
const MINING_TX_TIMEOUT_MS = 120_000;
const MINING_TX_MAX_WAIT_MS = 15_000;

async function loadCoachFeeContext(
  prisma: PrismaClient,
  userIds: string[],
  feePct: number,
): Promise<Map<string, boolean>> {
  /** userId → coachActive (hired and not afflicted). */
  const activeByUser = new Map<string, boolean>();
  if (feePct <= 0 || userIds.length === 0) {
    for (const id of userIds) activeByUser.set(id, false);
    return activeByUser;
  }

  const now = new Date();
  const [clubs, afflictions] = await Promise.all([
    prisma.club.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, coachHiredAt: true },
    }),
    prisma.affliction.findMany({
      where: {
        userId: { in: userIds },
        targetKind: 'coach',
        expiresAt: { gt: now },
      },
      select: { userId: true },
    }),
  ]);

  const hired = new Set(clubs.filter((c) => c.coachHiredAt).map((c) => c.userId));
  const afflicted = new Set(afflictions.map((a) => a.userId));
  for (const id of userIds) {
    activeByUser.set(id, hired.has(id) && !afflicted.has(id));
  }
  return activeByUser;
}

export interface MiningBlockResult {
  blockNumber: number;
  participantCount: number;
  totalOverwall: number;
  rewardUsdc: string;
  skipped?: 'paused' | 'duplicate' | 'no-overwall';
}

/** Sem Redis (testes antigos) todos contam como assistindo. Em produção o worker sempre passa Redis. */
export interface StadiumWatchLookup {
  mget(...keys: string[]): Promise<Array<string | null>>;
}

async function loadStadiumWatching(
  redis: StadiumWatchLookup | undefined,
  userIds: string[],
): Promise<Set<string>> {
  if (!redis || userIds.length === 0) return new Set(userIds);
  const values = await redis.mget(...userIds.map(stadiumWatchKey));
  const watching = new Set<string>();
  userIds.forEach((id, index) => {
    if (values[index]) watching.add(id);
  });
  return watching;
}

export async function runMiningBlock(
  prisma: PrismaClient,
  logger: Logger,
  redis?: StadiumWatchLookup,
): Promise<MiningBlockResult> {
  const cfg = await prisma.platformConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });

  const intervalMs = Math.max(1, cfg.miningBlockIntervalMin) * 60 * 1000;
  const blockNumber = Math.floor(Date.now() / intervalMs);
  const reward = new Prisma.Decimal(cfg.miningBlockRewardUsdc);

  if (cfg.miningPaused) {
    logger.warn({ event: 'mining.paused', blockNumber }, 'Patrocínios pausados na config — rodada ignorada');
    return {
      blockNumber,
      participantCount: 0,
      totalOverwall: 0,
      rewardUsdc: reward.toString(),
      skipped: 'paused',
    };
  }

  // Only players on the stadium lineup (saved escalação) count toward mining power.
  const powerByUser = await loadLineupPowerByUser(prisma);

  const totalOverwall = Array.from(powerByUser.values()).reduce((a, b) => a + b, 0);
  if (totalOverwall <= 0 || powerByUser.size === 0) {
    try {
      await prisma.miningBlock.create({
        data: {
          blockNumber: BigInt(blockNumber),
          totalOverwall: BigInt(0),
          rewardUsdc: reward,
          residualUsdt: new Prisma.Decimal(0),
          participantCount: 0,
        },
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      return {
        blockNumber,
        participantCount: 0,
        totalOverwall: 0,
        rewardUsdc: reward.toString(),
        skipped: 'duplicate',
      };
    }
    return {
      blockNumber,
      participantCount: 0,
      totalOverwall: 0,
      rewardUsdc: reward.toString(),
      skipped: 'no-overwall',
    };
  }

  const coachFeePct = Math.min(1, Math.max(0, Number(cfg.coachMiningFeePct ?? 0)));
  const userIds = Array.from(powerByUser.keys());
  const [coachActiveByUser, watchingIds] = await Promise.all([
    loadCoachFeeContext(prisma, userIds, coachFeePct),
    loadStadiumWatching(redis, userIds),
  ]);
  const pool = splitPool(
    'usdt',
    reward.toString(),
    Array.from(powerByUser.entries()).map(([userId, power]) => ({ key: userId, weight: power })),
  );

  let presenceWithheld = new Prisma.Decimal(0);
  const payouts = pool.shares.map((share) => {
    const full = new Prisma.Decimal(share.amount);
    const watching = watchingIds.has(share.key);
    if (watching) {
      return {
        userId: share.key,
        gross: full,
        presenceRate: STADIUM_WATCH_ONLINE_RATE,
      };
    }
    const cut = splitFeeRate('usdt', share.amount, STADIUM_WATCH_OFFLINE_CUT);
    const gross = new Prisma.Decimal(cut.net);
    presenceWithheld = presenceWithheld.add(cut.fee);
    return {
      userId: share.key,
      gross,
      presenceRate: STADIUM_WATCH_OFFLINE_RATE,
    };
  });
  const residualUsdt = new Prisma.Decimal(pool.residual).add(presenceWithheld);

  try {
    await prisma.$transaction(
      async (tx) => {
        const block = await tx.miningBlock.create({
          data: {
            blockNumber: BigInt(blockNumber),
            totalOverwall: BigInt(totalOverwall),
            rewardUsdc: reward,
            residualUsdt,
            participantCount: powerByUser.size,
          },
        });

        const rewardsData: Prisma.MiningRewardCreateManyInput[] = payouts.map((row) => ({
          blockId: block.id,
          userId: row.userId,
          overwallSnapshot: powerByUser.get(row.userId) ?? 0,
          share: new Prisma.Decimal(powerByUser.get(row.userId) ?? 0).div(totalOverwall),
          amountUsdc: row.gross,
          currency: 'usdt',
        }));

        if (rewardsData.length > 0) {
          await tx.miningReward.createMany({ data: rewardsData });
        }

        for (const row of payouts) {
          const gross = row.gross;
          if (gross.lte(0)) continue;

          const coachActive = coachActiveByUser.get(row.userId) === true;
          const feeSplit = coachActive && coachFeePct > 0
            ? splitFeeRate('usdt', gross.toString(), coachFeePct)
            : { fee: '0.000000', net: gross.toString() };
          const fee = new Prisma.Decimal(feeSplit.fee);
          const net = new Prisma.Decimal(feeSplit.net);

          await tx.mGTBalance.upsert({
            where: { userId: row.userId },
            create: { userId: row.userId, amount: 0, usdcAmount: 0, usdtAmount: 0 },
            update: {},
          });
          await applyUsdtCredit(tx, row.userId, gross.toString(), MgtTxType.MINING_CLAIM, {
            source: 'mining_block',
            blockNumber,
            coachFee: Number(fee),
            coachFeePct: coachActive ? coachFeePct : 0,
            presenceRate: row.presenceRate,
          });
          if (fee.gt(0)) {
            await applyUsdtDebit(tx, row.userId, fee.toString(), MgtTxType.COACH_FEE, {
              source: 'mining_block',
              blockNumber,
              gross: Number(gross),
              feePct: coachFeePct,
            });
          }
          await tx.miningBalance.upsert({
            where: { userId: row.userId },
            create: { userId: row.userId, pending: 0, lifetimeEarned: net },
            update: {
              lifetimeEarned: { increment: net },
            },
          });

          const userPower = powerByUser.get(row.userId) ?? 0;
          await attributeMiningRoiAndRetire(tx, row.userId, Number(net), userPower);
        }
      },
      { timeout: MINING_TX_TIMEOUT_MS, maxWait: MINING_TX_MAX_WAIT_MS },
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      logger.warn({ blockNumber }, 'Mining block already exists, skipping');
      return {
        blockNumber,
        participantCount: powerByUser.size,
        totalOverwall,
        rewardUsdc: reward.toString(),
        skipped: 'duplicate',
      };
    }
    throw err;
  }

  return {
    blockNumber,
    participantCount: powerByUser.size,
    totalOverwall,
    rewardUsdc: reward.toString(),
  };
}
