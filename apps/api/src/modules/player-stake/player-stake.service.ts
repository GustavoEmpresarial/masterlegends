import { Prisma, type PrismaClient } from '@prisma/client';
import {
  ErrorCode,
  isBelowMinimum,
  MgtTxType,
  quantizeMoney,
  stakeExitSplit,
  stakeGmtForRarityIndex,
  type PlayerStakeResultDTO,
} from '@mll/shared';
import type { LineupAssignment } from '@mll/shared';
import { AppError } from '../../common/lib/errors.js';
import { parseLineupAssignments } from '@mll/shared';
import { lockGmt, releaseGmt, settleLockedGmt } from '../wallet/mgt-ledger.js';
import { ClubRepository } from '../club/club.repository.js';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export interface ActivePlayerStake {
  stakedAt: string;
  amount: number;
}

export async function loadActiveStakes(
  prisma: PrismaClient,
  userId: string,
): Promise<Map<string, ActivePlayerStake>> {
  const rows = await prisma.playerStake.findMany({
    where: { userId, status: 'active' },
    select: { kind: true, playerId: true, stakedAt: true, amount: true },
  });
  const stakes = new Map<string, ActivePlayerStake>();
  for (const row of rows) {
    const at = row.stakedAt ? new Date(row.stakedAt) : null;
    stakes.set(`${row.kind}:${row.playerId}`, {
      stakedAt: at && !Number.isNaN(at.getTime()) ? at.toISOString() : new Date().toISOString(),
      amount: Number(row.amount ?? 0),
    });
  }
  return stakes;
}

function smallerDecimal(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.lte(b) ? a : b;
}

/**
 * Active stakes keep the current rarity table, including cards staked before the table changed.
 * Extra GMT is locked from the available balance. A lower stake returns the difference.
 */
export async function repriceActivePlayerStakes(
  prisma: PrismaClient,
): Promise<{ updated: number; shortUsers: number }> {
  const stakes = await prisma.playerStake.findMany({
    where: { status: 'active' },
    select: { id: true, userId: true, kind: true, playerId: true, amount: true },
  });
  if (stakes.length === 0) return { updated: 0, shortUsers: 0 };

  const baseIds = [...new Set(stakes.filter((row) => row.kind === 'base').map((row) => row.playerId))];
  const nftIds: bigint[] = [];
  for (const row of stakes) {
    if (row.kind !== 'nft') continue;
    try {
      nftIds.push(BigInt(row.playerId));
    } catch {
      // ignore a bad token id
    }
  }

  const [bases, nfts] = await Promise.all([
    baseIds.length > 0
      ? prisma.basePlayer.findMany({
          where: { id: { in: baseIds } },
          select: { id: true, rarity: true },
        })
      : Promise.resolve([]),
    nftIds.length > 0
      ? prisma.playerCache.findMany({
          where: { tokenId: { in: nftIds } },
          select: { tokenId: true, rarity: true },
        })
      : Promise.resolve([]),
  ]);

  const rarityByKey = new Map<string, number>();
  for (const player of bases) rarityByKey.set(`base:${player.id}`, player.rarity);
  for (const player of nfts) rarityByKey.set(`nft:${player.tokenId.toString()}`, player.rarity);

  const byUser = new Map<string, Array<{ id: string; from: Prisma.Decimal; to: Prisma.Decimal; delta: Prisma.Decimal }>>();
  for (const stake of stakes) {
    const rarityIndex = rarityByKey.get(`${stake.kind}:${stake.playerId}`);
    if (rarityIndex == null) continue;
    const to = new Prisma.Decimal(quantizeMoney('gmt', stakeGmtForRarityIndex(rarityIndex)));
    const from = new Prisma.Decimal(stake.amount);
    if (from.equals(to)) continue;
    const list = byUser.get(stake.userId) ?? [];
    list.push({ id: stake.id, from, to, delta: to.minus(from) });
    byUser.set(stake.userId, list);
  }

  let updated = 0;
  let shortUsers = 0;
  for (const [userId, changes] of byUser) {
    const result = await prisma.$transaction(async (tx) => {
      let net = new Prisma.Decimal(0);
      let won = 0;
      for (const change of changes) {
        const written = await tx.playerStake.updateMany({
          where: { id: change.id, status: 'active', amount: change.from },
          data: { amount: change.to },
        });
        if (written.count !== 1) continue;
        net = net.plus(change.delta);
        won += 1;
      }
      if (won === 0) return { won: 0, short: false };

      const balance = await tx.mGTBalance.findUnique({
        where: { userId },
        select: { amount: true, lockedAmount: true },
      });
      const available = new Prisma.Decimal(balance?.amount ?? 0);
      const locked = new Prisma.Decimal(balance?.lockedAmount ?? 0);
      let short = false;
      if (net.gt(0)) {
        const take = smallerDecimal(net, available.gt(0) ? available : new Prisma.Decimal(0));
        if (take.lt(net)) short = true;
        if (!isBelowMinimum('gmt', take.toString())) {
          await lockGmt(tx, userId, quantizeMoney('gmt', take.toString()), MgtTxType.PLAYER_STAKE, {
            repair: 'stake-reprice',
          });
        }
      } else if (net.lt(0)) {
        const give = smallerDecimal(net.neg(), locked.gt(0) ? locked : new Prisma.Decimal(0));
        if (!isBelowMinimum('gmt', give.toString())) {
          await releaseGmt(tx, userId, quantizeMoney('gmt', give.toString()), MgtTxType.PLAYER_UNSTAKE, {
            repair: 'stake-reprice',
          });
        }
      }
      return { won, short };
    });
    updated += result.won;
    if (result.short) shortUsers += 1;
  }

  return { updated, shortUsers };
}

export async function loadActiveStakeKeys(
  prisma: PrismaClient,
  userId: string,
): Promise<Set<string>> {
  const stakes = await loadActiveStakes(prisma, userId);
  return new Set(stakes.keys());
}

export class PlayerStakeService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clubRepo = new ClubRepository(prisma),
  ) {}

  async stake(userId: string, kind: 'base' | 'nft', playerId: string): Promise<PlayerStakeResultDTO> {
    const { rarityIndex } = await this.resolveOwnedPlayer(userId, kind, playerId);
    const amount = stakeGmtForRarityIndex(rarityIndex);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.playerStake.findUnique({
        where: { kind_playerId: { kind, playerId } },
      });
      if (existing?.status === 'active') {
        throw new AppError(ErrorCode.PLAYER_ALREADY_STAKED, 400, { kind, playerId });
      }
      if (existing && existing.userId !== userId) {
        throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 404);
      }

      const locked = await lockGmt(tx, userId, amount, MgtTxType.PLAYER_STAKE, {
        kind,
        playerId,
        rarityIndex,
      });

      if (existing) {
        await tx.playerStake.update({
          where: { id: existing.id },
          data: {
            userId,
            amount,
            status: 'active',
            stakedAt: new Date(),
            unstakedAt: null,
          },
        });
      } else {
        await tx.playerStake.create({
          data: {
            userId,
            kind,
            playerId,
            amount,
            status: 'active',
          },
        });
      }

      return {
        kind,
        playerId,
        staked: true,
        stakeGmt: amount,
        gmtLocked: locked.lockedAfter,
        gmtBalance: locked.balanceAfter,
      };
    });
  }

  async unstake(userId: string, kind: 'base' | 'nft', playerId: string): Promise<PlayerStakeResultDTO> {
    await this.resolveOwnedPlayer(userId, kind, playerId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.playerStake.findUnique({
        where: { kind_playerId: { kind, playerId } },
      });
      if (!existing || existing.status !== 'active' || existing.userId !== userId) {
        throw new AppError(ErrorCode.PLAYER_NOT_STAKED, 400, { kind, playerId });
      }

      const amount = Number(existing.amount);
      const split = stakeExitSplit(existing.amount.toString(), existing.stakedAt);
      await this.coverStakeLock(tx, userId);

      let gmtBalance = 0;
      let gmtLocked = 0;
      const meta = { kind, playerId, penaltyPercent: split.penaltyPercent };
      if (Number(split.penaltyGmt) > 0) {
        const settled = await settleLockedGmt(tx, userId, split.penaltyGmt, MgtTxType.PLAYER_UNSTAKE, meta);
        gmtBalance = settled.balanceAfter;
        gmtLocked = settled.lockedAfter;
      }
      if (Number(split.returnedGmt) > 0) {
        const released = await releaseGmt(tx, userId, split.returnedGmt, MgtTxType.PLAYER_UNSTAKE, meta);
        gmtBalance = released.balanceAfter;
        gmtLocked = released.lockedAfter;
      }

      await tx.playerStake.update({
        where: { id: existing.id },
        data: {
          status: 'unstaked',
          unstakedAt: new Date(),
        },
      });

      await this.removeFromLineup(tx, userId, kind, playerId);

      return {
        kind,
        playerId,
        staked: false,
        stakeGmt: amount,
        gmtLocked,
        gmtBalance,
        penaltyPercent: split.penaltyPercent,
        penaltyGmt: Number(split.penaltyGmt),
        returnedGmt: Number(split.returnedGmt),
      };
    });
  }

  /**
   * Stakes inserted outside lockGmt leave the wallet lock short of the active
   * rows. Pull the missing GMT from the available balance before a release,
   * so TIRAR returns the stake instead of failing with insufficient GMT.
   */
  private async coverStakeLock(tx: Tx, userId: string): Promise<void> {
    const [sumRow, balance] = await Promise.all([
      tx.playerStake.aggregate({
        where: { userId, status: 'active' },
        _sum: { amount: true },
      }),
      tx.mGTBalance.findUnique({
        where: { userId },
        select: { lockedAmount: true },
      }),
    ]);
    const need = Number(sumRow._sum.amount ?? 0);
    const locked = Number(balance?.lockedAmount ?? 0);
    const short = need - locked;
    if (short > 1e-8) {
      await lockGmt(tx, userId, short, MgtTxType.PLAYER_STAKE, {
        repair: 'stake-lock-shortfall',
      });
    }
  }

  private async removeFromLineup(
    tx: Tx,
    userId: string,
    kind: 'base' | 'nft',
    playerId: string,
  ): Promise<void> {
    const club = await tx.club.findUnique({ where: { userId }, select: { id: true } });
    if (!club) return;
    const lineup = await tx.clubLineup.findUnique({ where: { clubId: club.id } });
    if (!lineup) return;
    const assignments = parseLineupAssignments(lineup.assignments);
    let changed = false;
    const next: Record<string, LineupAssignment> = {};
    for (const [slotId, assignment] of Object.entries(assignments)) {
      if (assignment.kind === kind && assignment.playerId === playerId) {
        changed = true;
        continue;
      }
      next[slotId] = assignment;
    }
    if (!changed) return;
    await tx.clubLineup.update({
      where: { clubId: club.id },
      data: { assignments: next },
    });
  }

  private async resolveOwnedPlayer(
    userId: string,
    kind: 'base' | 'nft',
    playerId: string,
  ): Promise<{ rarityIndex: number }> {
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    if (kind === 'base') {
      const player = await this.prisma.basePlayer.findFirst({
        where: { id: playerId, userId, retiredAt: null },
        select: { rarity: true, listed: true },
      });
      if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 404);
      return { rarityIndex: player.rarity };
    }

    const wallet = club.user?.wallet ?? null;
    if (!wallet) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 404);
    let tokenId: bigint;
    try {
      tokenId = BigInt(playerId);
    } catch {
      throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 404);
    }
    const nft = await this.prisma.playerCache.findFirst({
      where: { tokenId, ownerWallet: wallet.toLowerCase() },
      select: { rarity: true },
    });
    if (!nft) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 404);
    return { rarityIndex: nft.rarity };
  }
}
