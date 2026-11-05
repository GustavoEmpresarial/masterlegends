import { Worker, Queue } from 'bullmq';
import type Redis from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import {
  ChainEvent,
  CHAIN_INDEXER_QUEUE,
  REFERRAL_REWARDS_QUEUE,
  SEASON_RESET_QUEUE,
  STAMINA_RECOVERY_QUEUE,
  MINING_QUEUE,
  parseLineupAssignments,
  applyStaminaDrift,
  staminaDrainPerHourForIndex,
  MIN_STAMINA_AUTO_FIELD,
  fillRecoveredLineup,
} from '@mll/shared';
import { startEmailWorker } from './email.worker.js';
import { startTelegramWorker } from './telegram.worker.js';
import { runMiningBlock } from './mining.worker.js';
import { scanVaultDeposits } from './deposit-scanner.worker.js';
import { recheckPendingDepositClaims } from './deposit-claim.worker.js';
import { processUsdcVaultEvent } from '../lib/vault-events.js';
import { config } from '../config/env.js';
import { expireFreeFieldLineups } from '../lib/free-field-lineup.js';

const STAMINA_CRON_ID = 'stamina-recover-cron';
const SEASON_CRON_ID = 'season-reset-cron';
const MINING_CRON_ID = 'mining-cron';
const DEPOSIT_SCANNER_CRON_ID = 'vault-deposit-scanner-cron';
const DEPOSIT_CLAIM_CRON_ID = 'deposit-claim-recheck-cron';

export interface WorkerHandles {
  workers: Worker[];
  queues: Queue[];
}

export async function setupWorkers(
  redis: Redis,
  prisma: PrismaClient,
  logger: Logger,
): Promise<WorkerHandles> {
  const workers: Worker[] = [];
  const queues: Queue[] = [];

  const staminaWorker = new Worker(
    STAMINA_RECOVERY_QUEUE,
    async () => {
      const now = new Date();
      await expireFreeFieldLineups(prisma, now);
      let nftCount = 0;
      let baseCount = 0;
      let skippedOnField = 0;
      let skippedNoCoach = 0;
      let fieldDrainCount = 0;

      const platformCfg = await prisma.platformConfig.findUnique({
        where: { id: 'default' },
        select: { coachStaminaRecoveryPerHour: true },
      });
      const recoveryPerHour = platformCfg?.coachStaminaRecoveryPerHour ?? 24;

      async function writeLedger(
        userId: string,
        playerKind: 'base' | 'nft',
        playerId: string,
        reason: 'coach' | 'field',
        before: number,
        after: number,
      ) {
        if (before === after) return;
        await prisma.$executeRaw`
          INSERT INTO "StaminaLedger" ("id", "userId", "playerKind", "playerId", "reason", "delta", "before", "after", "createdAt")
          VALUES (
            gen_random_uuid()::text,
            ${userId},
            ${playerKind},
            ${playerId},
            ${reason},
            ${after - before},
            ${before},
            ${after},
            NOW()
          )
        `;
      }

      type ClubCtx = {
        clubId: string;
        ctLvl: number;
        coachHired: boolean;
        onFieldBase: Set<string>;
        onFieldNft: Set<string>;
      };

      const ctxByUser = new Map<string, ClubCtx | null>();

      async function getCtxByUserId(userId: string): Promise<ClubCtx | null> {
        if (ctxByUser.has(userId)) return ctxByUser.get(userId) ?? null;
        const club = await prisma.club.findUnique({
          where: { userId },
          select: { id: true, coachHiredAt: true, ctLvl: true },
        });
        if (!club) {
          ctxByUser.set(userId, null);
          return null;
        }
        const coachAffliction = await prisma.affliction.findFirst({
          where: { userId, targetKind: 'coach', expiresAt: { gt: now } },
          select: { id: true },
        });
        const coachActive = !!club.coachHiredAt && !coachAffliction;
        const lineup = await prisma.clubLineup.findUnique({
          where: { clubId: club.id },
          select: { assignments: true },
        });
        const assignments = lineup ? parseLineupAssignments(lineup.assignments) : {};
        const onFieldBase = new Set<string>();
        const onFieldNft = new Set<string>();
        for (const a of Object.values(assignments)) {
          if (a.kind === 'base') onFieldBase.add(a.playerId);
          else onFieldNft.add(a.playerId);
        }
        const ctx: ClubCtx = {
          clubId: club.id,
          ctLvl: club.ctLvl,
          coachHired: coachActive,
          onFieldBase,
          onFieldNft,
        };
        ctxByUser.set(userId, ctx);
        return ctx;
      }

      const nftPlayers = await prisma.playerCache.findMany({
        where: { stamina: { lt: 100 } },
        select: {
          tokenId: true,
          ownerWallet: true,
          stamina: true,
          staminaUpdatedAt: true,
        },
      });

      for (const player of nftPlayers) {
        const ownerUser = await prisma.user.findFirst({
          where: { wallet: player.ownerWallet.toLowerCase() },
          select: { id: true },
        });
        if (!ownerUser) continue;
        const ctx = await getCtxByUserId(ownerUser.id);
        if (!ctx) continue;
        if (!ctx.coachHired) {
          skippedNoCoach += 1;
          continue;
        }
        if (ctx.onFieldNft.has(player.tokenId.toString())) {
          skippedOnField += 1;
          continue;
        }

        const newStamina = applyStaminaDrift(
          player.stamina,
          player.staminaUpdatedAt,
          now,
          true,
          recoveryPerHour + ctx.ctLvl,
          false,
        );
        if (newStamina === player.stamina) continue;

        await prisma.playerCache.update({
          where: { tokenId: player.tokenId },
          data: { stamina: newStamina, staminaUpdatedAt: now },
        });
        await writeLedger(ownerUser.id, 'nft', player.tokenId.toString(), 'coach', player.stamina, newStamina);
        nftCount += 1;
      }

      const basePlayers = await prisma.basePlayer.findMany({
        where: { stamina: { lt: 100 } },
        select: { id: true, userId: true, stamina: true, staminaUpdatedAt: true },
      });

      for (const player of basePlayers) {
        const ctx = await getCtxByUserId(player.userId);
        if (!ctx) continue;
        if (!ctx.coachHired) {
          skippedNoCoach += 1;
          continue;
        }
        if (ctx.onFieldBase.has(player.id)) {
          skippedOnField += 1;
          continue;
        }

        const newStamina = applyStaminaDrift(
          player.stamina,
          player.staminaUpdatedAt,
          now,
          true,
          recoveryPerHour + ctx.ctLvl,
          false,
        );
        if (newStamina === player.stamina) continue;

        await prisma.basePlayer.update({
          where: { id: player.id },
          data: { stamina: newStamina, staminaUpdatedAt: now },
        });
        await writeLedger(player.userId, 'base', player.id, 'coach', player.stamina, newStamina);
        baseCount += 1;
      }

      const baseOnField = await prisma.basePlayer.findMany({
        select: { id: true, userId: true, rarity: true, stamina: true, staminaUpdatedAt: true },
      });
      for (const player of baseOnField) {
        const ctx = await getCtxByUserId(player.userId);
        if (!ctx || !ctx.onFieldBase.has(player.id)) continue;
        const fieldDrain = staminaDrainPerHourForIndex(player.rarity);
        const newStamina = applyStaminaDrift(
          player.stamina,
          player.staminaUpdatedAt,
          now,
          false,
          24,
          true,
          fieldDrain,
        );
        if (newStamina !== player.stamina) {
          await prisma.basePlayer.update({
            where: { id: player.id },
            data: { stamina: newStamina, staminaUpdatedAt: now },
          });
          await writeLedger(player.userId, 'base', player.id, 'field', player.stamina, newStamina);
          fieldDrainCount += 1;
        }
      }

      const nftOnFieldCandidates = await prisma.playerCache.findMany({
        where: { stamina: { gt: 0 } },
        select: { tokenId: true, ownerWallet: true, rarity: true, stamina: true, staminaUpdatedAt: true },
      });
      for (const player of nftOnFieldCandidates) {
        const ownerUser = await prisma.user.findFirst({
          where: { wallet: player.ownerWallet.toLowerCase() },
          select: { id: true },
        });
        if (!ownerUser) continue;
        const ctx = await getCtxByUserId(ownerUser.id);
        if (!ctx || !ctx.onFieldNft.has(player.tokenId.toString())) continue;
        const fieldDrain = staminaDrainPerHourForIndex(player.rarity);
        const newStamina = applyStaminaDrift(
          player.stamina,
          player.staminaUpdatedAt,
          now,
          false,
          24,
          true,
          fieldDrain,
        );
        if (newStamina !== player.stamina) {
          await prisma.playerCache.update({
            where: { tokenId: player.tokenId },
            data: { stamina: newStamina, staminaUpdatedAt: now },
          });
          await writeLedger(ownerUser.id, 'nft', player.tokenId.toString(), 'field', player.stamina, newStamina);
          fieldDrainCount += 1;
        }
      }

      // Coach auto-rotation: remove depleted players and re-insert recovered ones
      let rotatedOut = 0;
      let rotatedIn = 0;

      const lineups = await prisma.clubLineup.findMany({
        include: {
          club: {
            select: {
              id: true,
              userId: true,
              coachHiredAt: true,
              user: { select: { wallet: true } },
            },
          },
        },
      });

      for (const lineup of lineups) {
        const club = lineup.club;
        const coachAffliction = await prisma.affliction.findFirst({
          where: { userId: club.userId, targetKind: 'coach', expiresAt: { gt: now } },
          select: { id: true },
        });
        if (!club.coachHiredAt || coachAffliction) continue;

        let assignments = parseLineupAssignments(lineup.assignments);
        let changed = false;

        // Step 1: remove retired/listed/dead players (stamina 0).
        // Do NOT bench merely because stamina < 100 — only re-entry requires full stamina.
        for (const [slot, a] of Object.entries(assignments)) {
          if (a.kind === 'base') {
            const p = await prisma.basePlayer.findUnique({
              where: { id: a.playerId },
              select: { stamina: true, retiredAt: true, listed: true },
            });
            if (!p || p.retiredAt || p.listed || p.stamina <= 0) {
              delete assignments[slot];
              changed = true;
              rotatedOut += 1;
            }
          } else {
            const p = await prisma.playerCache.findUnique({
              where: { tokenId: BigInt(a.playerId) },
              select: { stamina: true },
            });
            if (!p || p.stamina <= 0) {
              delete assignments[slot];
              changed = true;
              rotatedOut += 1;
            }
          }
        }

        // Step 2: return staked players at 100% into an empty slot of the same position.
        // They leave only at 0. Nobody is swapped out while they still have stamina.
        const vestiario = await prisma.vestiarioTemplate.findFirst({
          where: { isDefault: true },
          select: { slots: true },
        });
        const slots = Array.isArray(vestiario?.slots)
          ? (vestiario.slots as Array<{ id?: string; role?: string }>)
              .filter((slot) => slot.id && slot.role)
              .map((slot) => ({ id: slot.id as string, role: slot.role as string }))
          : [];
        if (slots.length > 0) {
        const stakes = await prisma.playerStake.findMany({
          where: { userId: club.userId, status: 'active' },
          select: { kind: true, playerId: true },
        });
        const staked = new Set(stakes.map((row) => `${row.kind}:${row.playerId}`));
        const onField = new Set(
          Object.values(assignments).map((a) => `${a.kind}:${a.playerId}`),
        );

        const baseCandidates = await prisma.basePlayer.findMany({
          where: {
            userId: club.userId,
            stamina: { gte: MIN_STAMINA_AUTO_FIELD },
            retiredAt: null,
            listed: false,
          },
          select: { id: true, overwall: true, position: true },
        });
        const nftCandidates = club.user?.wallet
          ? await prisma.playerCache.findMany({
              where: { ownerWallet: club.user.wallet, stamina: { gte: MIN_STAMINA_AUTO_FIELD } },
              select: { tokenId: true, overwall: true, position: true },
            })
          : [];

        const recovered = [
          ...baseCandidates.map((p) => ({
            playerId: p.id,
            kind: 'base' as const,
            overwall: p.overwall,
            position: p.position,
          })),
          ...nftCandidates.map((p) => ({
            playerId: p.tokenId.toString(),
            kind: 'nft' as const,
            overwall: p.overwall,
            position: p.position,
          })),
        ].filter((c) => staked.has(`${c.kind}:${c.playerId}`) && !onField.has(`${c.kind}:${c.playerId}`));

        const filled = fillRecoveredLineup(slots, assignments, recovered);
        if (filled.changed) {
          const before = Object.keys(assignments).length;
          assignments = filled.assignments;
          rotatedIn += Object.keys(assignments).length - before;
          changed = true;
        }
        }

        if (changed) {
          await prisma.clubLineup.update({
            where: { clubId: club.id },
            data: {
              assignments: assignments as unknown as Parameters<
                typeof prisma.clubLineup.update
              >[0]['data']['assignments'],
            },
          });
        }
      }

      logger.info(
        {
          event: 'job.completed',
          queue: STAMINA_RECOVERY_QUEUE,
          nftCount,
          baseCount,
          skippedOnField,
          skippedNoCoach,
          fieldDrainCount,
          rotatedOut,
          rotatedIn,
        },
        'Stamina recovery finished',
      );
    },
    { connection: redis },
  );
  workers.push(staminaWorker);

  const staminaQueue = new Queue(STAMINA_RECOVERY_QUEUE, { connection: redis });
  queues.push(staminaQueue);
  await staminaQueue.add(
    'recover',
    {},
    {
      jobId: STAMINA_CRON_ID,
      repeat: { every: 60 * 1000 },
    },
  );

  const indexerWorker = new Worker(
    CHAIN_INDEXER_QUEUE,
    async (job) => {
      const { event, data } = job.data as { event: string; data: Record<string, unknown> };

      switch (event) {
        case ChainEvent.PlayerMinted:
          await handlePlayerMinted(prisma, data);
          break;
        case ChainEvent.PlayerBurned:
          await handlePlayerBurned(prisma, data);
          break;
        case ChainEvent.ItemListed:
          await handleItemListed(prisma, data);
          break;
        case ChainEvent.ItemSold:
          await handleItemSold(prisma, data);
          break;
        case ChainEvent.PlayersFused:
          await handlePlayersFused(prisma, data);
          break;
        case ChainEvent.UsdcDeposited:
        case ChainEvent.UsdcWithdrawn:
          {
            await processUsdcVaultEvent(
              prisma,
              event as typeof ChainEvent.UsdcDeposited | typeof ChainEvent.UsdcWithdrawn,
              data as unknown as Parameters<typeof processUsdcVaultEvent>[2],
              logger,
            );
          }
          break;
      }

      logger.info(
        { event: 'job.completed', queue: CHAIN_INDEXER_QUEUE, chainEvent: event },
        'Chain event processed',
      );
    },
    { connection: redis },
  );
  workers.push(indexerWorker);

  const seasonWorker = new Worker(
    SEASON_RESET_QUEUE,
    async () => {
      const activeSeason = await prisma.season.findFirst({ where: { active: true } });
      if (!activeSeason) return;

      const now = new Date();
      if (now >= activeSeason.endsAt) {
        await prisma.season.update({
          where: { id: activeSeason.id },
          data: { active: false },
        });

        logger.info(
          { event: 'job.completed', queue: SEASON_RESET_QUEUE, seasonId: activeSeason.id },
          'Pass season ended — publish a new one in admin',
        );
      }
    },
    { connection: redis },
  );
  workers.push(seasonWorker);

  const seasonQueue = new Queue(SEASON_RESET_QUEUE, { connection: redis });
  queues.push(seasonQueue);
  await seasonQueue.add(
    'check',
    {},
    {
      jobId: SEASON_CRON_ID,
      repeat: { every: 24 * 60 * 60 * 1000 },
    },
  );

  const miningWorker = new Worker(
    MINING_QUEUE,
    async () => {
      const result = await runMiningBlock(prisma, logger, redis);
      try {
        await retireExpiredReferralNfts(prisma, logger);
      } catch (err) {
        logger.error(
          { event: 'referral_nft.retire_failed', err, blockNumber: result.blockNumber },
          'Referral NFT retirement failed after mining — mining rewards were already committed',
        );
      }
      logger.info(
        { event: 'job.completed', queue: MINING_QUEUE, ...result },
        'Mining block processed',
      );
    },
    { connection: redis, concurrency: 1 },
  );
  miningWorker.on('failed', (job, err) => {
    logger.error(
      { event: 'job.failed', queue: MINING_QUEUE, jobId: job?.id, err: err.message },
      'Mining job failed',
    );
  });
  workers.push(miningWorker);

  let intervalMin = 10;
  try {
    const cfg = await prisma.platformConfig.findUnique({ where: { id: 'default' } });
    intervalMin = cfg?.miningBlockIntervalMin ?? 10;
  } catch (err) {
    logger.warn(
      { event: 'worker.platform_config_missing', err },
      'PlatformConfig unavailable — using default mining interval',
    );
  }

  const miningQueue = new Queue(MINING_QUEUE, { connection: redis });
  queues.push(miningQueue);
  await miningQueue.add(
    'mine',
    {},
    {
      jobId: MINING_CRON_ID,
      repeat: { every: intervalMin * 60 * 1000 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  );

  const referralWorker = new Worker(
    REFERRAL_REWARDS_QUEUE,
    async () => {
      // Commission is only a cut of a confirmed USDC deposit. This queue used to
      // pay 5% of a GMT spend and has no caller.
    },
    { connection: redis },
  );
  workers.push(referralWorker);

  workers.push(startEmailWorker(redis));
  workers.push(startTelegramWorker(redis));

  const depositScannerWorker = new Worker(
    'vault-deposit-scanner',
    async () => {
      await scanVaultDeposits(prisma, redis, logger);
    },
    { connection: redis },
  );
  workers.push(depositScannerWorker);

  const depositScannerQueue = new Queue('vault-deposit-scanner', { connection: redis });
  queues.push(depositScannerQueue);
  await depositScannerQueue.add(
    'scan',
    {},
    {
      jobId: DEPOSIT_SCANNER_CRON_ID,
      repeat: { every: 60 * 1000 },
    },
  );

  const depositClaimWorker = new Worker(
    'deposit-claim-recheck',
    async () => {
      await recheckPendingDepositClaims(prisma, logger);
    },
    { connection: redis },
  );
  workers.push(depositClaimWorker);

  const depositClaimQueue = new Queue('deposit-claim-recheck', { connection: redis });
  queues.push(depositClaimQueue);
  await depositClaimQueue.add(
    'recheck',
    {},
    {
      jobId: DEPOSIT_CLAIM_CRON_ID,
      repeat: { every: 10 * 60 * 1000 },
    },
  );

  logger.info({ event: 'worker.boot', queues: workers.length }, 'All workers initialized');

  return { workers, queues };
}

async function handlePlayerMinted(prisma: PrismaClient, data: Record<string, unknown>) {
  const { tokenId, owner, rarity, overwall, position } = data;

  await prisma.playerCache.upsert({
    where: { tokenId: BigInt(tokenId as string | number | bigint) },
    update: {
      ownerWallet: String(owner).toLowerCase(),
      rarity: Number(rarity),
      overwall: Number(overwall),
      position: Number(position),
      stamina: 100,
      staminaUpdatedAt: new Date(),
    },
    create: {
      tokenId: BigInt(tokenId as string | number | bigint),
      ownerWallet: String(owner).toLowerCase(),
      rarity: Number(rarity),
      overwall: Number(overwall),
      position: Number(position),
      stamina: 100,
      staminaUpdatedAt: new Date(),
    },
  });
}

async function handlePlayerBurned(prisma: PrismaClient, data: Record<string, unknown>) {
  await prisma.playerCache.delete({
    where: { tokenId: BigInt(data.tokenId as string | number | bigint) },
  });
}

async function handleItemListed(prisma: PrismaClient, data: Record<string, unknown>) {
  const { listingId, tokenId, seller, price } = data;
  const player = await prisma.playerCache.findUnique({
    where: { tokenId: BigInt(tokenId as string | number | bigint) },
  });
  if (!player) return;

  const sellerWallet = String(seller).toLowerCase();
  const sellerUser = await prisma.user.findFirst({
    where: { wallet: sellerWallet },
  });
  if (!sellerUser) return;

  await prisma.listing.create({
    data: {
      id: String(listingId),
      tokenId: BigInt(tokenId as string | number | bigint),
      sellerId: sellerUser.id,
      price: Number(price) / 1e6,
      rarity: player.rarity,
      overwall: player.overwall,
      position: player.position,
    },
  });
}

async function handleItemSold(prisma: PrismaClient, data: Record<string, unknown>) {
  await prisma.listing.update({
    where: { id: String(data.listingId) },
    data: { active: false },
  });
}

async function retireExpiredReferralNfts(prisma: PrismaClient, logger: Logger): Promise<void> {
  const now = new Date();
  const expired = await prisma.basePlayer.findMany({
    where: {
      source: { in: ['referral', 'checkin_streak', 'social_reward'] },
      expiresAt: { lte: now },
      retiredAt: null,
    },
    select: { id: true, userId: true, source: true },
  });
  if (expired.length === 0) return;

  const ids = expired.map((p) => p.id);

  await prisma.basePlayer.updateMany({
    where: { id: { in: ids } },
    data: { retiredAt: now, listed: false },
  });

  // Remove from lineups: for each affected user, strip these players from their ClubLineup assignments
  const userIds = [...new Set(expired.map((p) => p.userId))];
  for (const userId of userIds) {
    const club = await prisma.club.findUnique({ where: { userId }, select: { id: true } });
    if (!club) continue;
    const lineup = await prisma.clubLineup.findUnique({
      where: { clubId: club.id },
      select: { assignments: true, stadiumTemplateId: true },
    });
    if (!lineup) continue;

    const assignments = parseLineupAssignments(lineup.assignments);
    const expiredSet = new Set(ids);
    let changed = false;
    const cleaned: Record<string, { kind: 'base' | 'nft'; playerId: string }> = {};
    for (const [slotId, a] of Object.entries(assignments)) {
      if (a.kind === 'base' && expiredSet.has(a.playerId)) {
        changed = true;
      } else {
        cleaned[slotId] = a;
      }
    }
    if (changed) {
      await prisma.clubLineup.update({
        where: { clubId: club.id },
        data: { assignments: cleaned },
      });
    }
  }

  logger.info(
    {
      event: 'temp_players.retired',
      count: ids.length,
      bySource: expired.reduce<Record<string, number>>((acc, p) => {
        acc[p.source] = (acc[p.source] ?? 0) + 1;
        return acc;
      }, {}),
    },
    'Retired expired temporary players',
  );
}

async function handlePlayersFused(prisma: PrismaClient, data: Record<string, unknown>) {
  const { burnedIds, newTokenId, newRarity, newOverwall, owner } = data;
  const ids = burnedIds as Array<string | number | bigint>;

  for (const tokenId of ids) {
    await prisma.playerCache
      .delete({ where: { tokenId: BigInt(tokenId) } })
      .catch(() => {});
  }

  await prisma.playerCache.create({
    data: {
      tokenId: BigInt(newTokenId as string | number | bigint),
      ownerWallet: String(owner).toLowerCase(),
      rarity: Number(newRarity),
      overwall: Number(newOverwall),
      position: 0,
      stamina: 100,
      staminaUpdatedAt: new Date(),
    },
  });
}
