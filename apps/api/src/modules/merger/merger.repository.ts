import { Prisma, PrismaClient } from '@prisma/client';
import { parseLineupAssignments, rollPlayerAttributes } from '@mll/shared';
import { randomUUID } from 'node:crypto';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { applyMergeFeeDebit, type MergePaymentCurrency } from '../wallet/mgt-ledger.js';

export interface MergeCreateInput {
  rarity: number;
  overwall: number;
  position: number;
  name?: string | null;
  imageUrl?: string | null;
  templateId?: string | null;
  /** Σ(inputs.costBasis) + merge fee — career continuity. Legendary has a floor. */
  costBasisUsdc?: number;
  /** Σ(inputs.lifetimeEarned) — mining progress preserved across fuse. */
  lifetimeEarnedUsdc?: number;
}

interface LockedPlayer {
  id: string;
  rarity: number;
  overwall: number;
  listed: boolean;
  retiredAt: Date | null;
}

export class MergerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findBasePlayersByIds(userId: string, ids: string[]) {
    return this.prisma.basePlayer.findMany({
      where: { userId, id: { in: ids } },
    });
  }

  async fuse(
    userId: string,
    clubId: string,
    burnedIds: string[],
    feeUsdc: number,
    created: MergeCreateInput,
    payWith: MergePaymentCurrency = 'gmt',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const debit = await applyMergeFeeDebit(tx, userId, feeUsdc, {
        inputCount: burnedIds.length,
        outputRarity: created.rarity,
      }, payWith);
      if (!debit.transactionId) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 500, { reason: 'merge debit has no ledger id' });
      }

      const locked = await tx.$queryRaw<LockedPlayer[]>`
        SELECT id, rarity, overwall, listed, "retiredAt"
        FROM "BasePlayer"
        WHERE "userId" = ${userId}
          AND id IN (${Prisma.join(burnedIds)})
        FOR UPDATE
      `;
      if (locked.length !== burnedIds.length) {
        throw new AppError(ErrorCode.MERGE_PLAYER_NOT_FOUND, 409, { expected: burnedIds.length, found: locked.length });
      }

      const listed = locked.find((player) => player.listed);
      if (listed) {
        throw new AppError(ErrorCode.MERGE_PLAYER_LISTED, 400, { playerId: listed.id });
      }
      const retired = locked.find((player) => player.retiredAt != null);
      if (retired) {
        throw new AppError(ErrorCode.MERGE_PLAYER_RETIRED, 400, { playerId: retired.id });
      }
      if (!locked.every((player) => player.rarity === locked[0]!.rarity)) {
        throw new AppError(ErrorCode.MERGE_DIFFERENT_RARITY, 400);
      }

      const lineup = await tx.clubLineup.findUnique({
        where: { clubId },
        select: { assignments: true },
      });
      const assignments = lineup ? parseLineupAssignments(lineup.assignments) : {};
      const lineupIds = new Set(
        Object.values(assignments)
          .filter((slot) => slot.kind === 'base')
          .map((slot) => slot.playerId),
      );
      const inLineup = locked.find((player) => lineupIds.has(player.id));
      if (inLineup) {
        throw new AppError(ErrorCode.MERGE_PLAYER_IN_LINEUP, 400, { playerId: inLineup.id });
      }

      const removed = await tx.basePlayer.deleteMany({
        where: { userId, id: { in: burnedIds } },
      });
      if (removed.count !== burnedIds.length) {
        throw new AppError(ErrorCode.MERGE_PLAYER_NOT_FOUND, 409, { deleted: removed.count });
      }

      const byId = new Map(locked.map((player) => [player.id, player]));
      const sources = burnedIds.map((id) => {
        const player = byId.get(id)!;
        return { id: player.id, rarity: player.rarity, overwall: player.overwall };
      });
      const overwallBefore = sources.reduce((sum, player) => sum + player.overwall, 0);

      const id = randomUUID();
      const row = await tx.basePlayer.create({
        data: {
          id,
          userId,
          rarity: created.rarity,
          overwall: created.overwall,
          position: created.position,
          attributes: rollPlayerAttributes(id, created.rarity, created.position),
          name: created.name ?? null,
          imageUrl: created.imageUrl ?? null,
          templateId: created.templateId ?? null,
          stamina: 100,
          costBasisUsdc: created.costBasisUsdc ?? 0,
          lifetimeEarnedUsdc: created.lifetimeEarnedUsdc ?? 0,
          source: 'merge',
        },
      });

      const owner = await tx.user.findUnique({ where: { id: userId }, select: { wallet: true } });
      await tx.mergeRecord.create({
        data: {
          userId,
          wallet: owner?.wallet ?? null,
          cost: new Prisma.Decimal(feeUsdc),
          sources,
          overwallBefore,
          resultPlayerId: id,
          overwallAfter: created.overwall,
          mgtTransactionId: debit.transactionId,
        },
      });

      await tx.mGTTransaction.update({
        where: { id: debit.transactionId },
        data: {
          meta: {
            currency: 'gmt',
            inputCount: burnedIds.length,
            outputRarity: created.rarity,
            sourceIds: burnedIds,
            resultPlayerId: id,
            overwallBefore,
            overwallAfter: created.overwall,
          },
        },
      });

      const agg = await tx.basePlayer.aggregate({
        where: { userId },
        _sum: { overwall: true },
      });

      await tx.club.update({
        where: { userId },
        data: { totalOverwall: agg._sum.overwall ?? 0 },
      });

      return row;
    });
  }
}
