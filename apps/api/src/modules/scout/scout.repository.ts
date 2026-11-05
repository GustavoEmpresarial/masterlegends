import { Prisma, PrismaClient } from '@prisma/client';
import { MgtTxType, rollPlayerAttributes, type PlayerAttributes } from '@mll/shared';
import { randomUUID } from 'node:crypto';
import { applyMgtDebit } from '../wallet/mgt-ledger.js';

export interface RolledPlayer {
  overwall: number;
  position: number;
  rarity: number;
  name?: string | null;
  imageUrl?: string | null;
  templateId?: string | null;
  /** GMT desta carta. Se faltar, usa o preço fixo do mint. */
  mintCostGmt?: number;
}

export interface MintedPlayerRow {
  id: string;
  overwall: number;
  position: number;
  rarity: number;
  name: string | null;
  imageUrl: string | null;
  attributes: PlayerAttributes;
}

export class ScoutRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async mintPlayers(
    userId: string,
    _totalCost: number,
    unitCostUsdc: number,
    quantity: number,
    roll: () => Promise<RolledPlayer>,
  ): Promise<MintedPlayerRow[]> {
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.findUnique({ where: { id: userId }, select: { wallet: true } });
      const wallet = owner?.wallet ?? null;
      const drafted: Array<RolledPlayer & { id: string; attributes: PlayerAttributes; mintCostGmt: number }> = [];

      for (let i = 0; i < quantity; i++) {
        const player = await roll();
        const id = randomUUID();
        const mintCostGmt = player.mintCostGmt ?? unitCostUsdc;
        drafted.push({
          ...player,
          id,
          mintCostGmt,
          attributes: rollPlayerAttributes(id, player.rarity, player.position),
        });
      }

      const charged = parseFloat(drafted.reduce((sum, player) => sum + player.mintCostGmt, 0).toFixed(4));
      const { transactionId } = await applyMgtDebit(tx, userId, charged, MgtTxType.SCOUT, {
        quantity,
      });

      const minted: MintedPlayerRow[] = [];

      for (const player of drafted) {
        await tx.basePlayer.create({
          data: {
            id: player.id,
            userId,
            rarity: player.rarity,
            overwall: player.overwall,
            position: player.position,
            attributes: player.attributes,
            name: player.name ?? null,
            imageUrl: player.imageUrl ?? null,
            templateId: player.templateId ?? null,
            costBasisUsdc: player.mintCostGmt,
            lifetimeEarnedUsdc: 0,
            source: 'scout',
          },
        });
        await tx.mintRecord.create({
          data: {
            userId,
            wallet,
            cost: new Prisma.Decimal(player.mintCostGmt || unitCostUsdc),
            basePlayerId: player.id,
            rarity: player.rarity,
            attributes: player.attributes,
            mgtTransactionId: transactionId,
          },
        });
        minted.push({
          id: player.id,
          overwall: player.overwall,
          position: player.position,
          rarity: player.rarity,
          name: player.name ?? null,
          imageUrl: player.imageUrl ?? null,
          attributes: player.attributes,
        });
      }

      await tx.mGTTransaction.update({
        where: { id: transactionId },
        data: {
          meta: {
            currency: 'gmt',
            quantity,
            playerIds: minted.map((row) => row.id),
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

      return minted;
    });
  }
}
