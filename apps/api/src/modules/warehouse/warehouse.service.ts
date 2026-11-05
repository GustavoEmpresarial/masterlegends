import type { Prisma, PrismaClient } from '@prisma/client';
import type { WarehouseItemDTO, WarehouseClaimResultDTO } from '@mll/shared';
import {
  ErrorCode,
  MgtTxType,
  STAMINA_MAX,
  WarehouseItemType,
  WarehouseSource,
} from '@mll/shared';
import { AppError } from '../../common/lib/errors.js';
import { writeStaminaLedger } from '../stamina/stamina-ledger.js';
import { applyMgtCredit } from '../wallet/mgt-ledger.js';

type Tx = Prisma.TransactionClient;

const CLAIMABLE_TYPES = new Set([
  WarehouseItemType.PLAYER_CARD,
  WarehouseItemType.TEMP_PLAYER,
  WarehouseItemType.STAMINA_BOOST,
  WarehouseItemType.GMT_PACK,
  WarehouseItemType.OVERWALL_BOOST,
  WarehouseItemType.SCOUT_TICKET,
]);

function mapRow(row: Record<string, unknown>): WarehouseItemDTO {
  return {
    id: String(row.id),
    userId: String(row.userId),
    itemType: String(row.itemType),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    imageUrl: row.imageUrl ? String(row.imageUrl) : null,
    rarity: Number(row.rarity),
    quantity: Number(row.quantity),
    data: (row.data as Record<string, unknown>) ?? {},
    source: String(row.source),
    sourceRef: row.sourceRef ? String(row.sourceRef) : null,
    claimed: Boolean(row.claimed),
    claimedAt: row.claimedAt ? new Date(row.claimedAt as string).toISOString() : null,
    expiresAt: row.expiresAt ? new Date(row.expiresAt as string).toISOString() : null,
    createdAt: new Date(row.createdAt as string).toISOString(),
    updatedAt: new Date(row.updatedAt as string).toISOString(),
  };
}

export class WarehouseService {
  constructor(private readonly prisma: PrismaClient) {}

  async listUserItems(userId: string): Promise<{ items: WarehouseItemDTO[]; total: number; pending: number }> {
    const [items, total, pending] = await Promise.all([
      this.prisma.warehouseItem.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.warehouseItem.count({ where: { userId } }),
      this.prisma.warehouseItem.count({ where: { userId, claimed: false } }),
    ]);

    return {
      items: items.map((i) => mapRow(i as unknown as Record<string, unknown>)),
      total,
      pending,
    };
  }

  async listPendingItems(userId: string): Promise<WarehouseItemDTO[]> {
    const items = await this.prisma.warehouseItem.findMany({
      where: { userId, claimed: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return items.map((i) => mapRow(i as unknown as Record<string, unknown>));
  }

  async getItem(userId: string, itemId: string): Promise<WarehouseItemDTO | null> {
    const item = await this.prisma.warehouseItem.findFirst({
      where: { id: itemId, userId },
    });

    if (!item) return null;
    return mapRow(item as unknown as Record<string, unknown>);
  }

  async claimItem(
    userId: string,
    itemId: string,
  ): Promise<WarehouseClaimResultDTO> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.warehouseItem.findFirst({
        where: { id: itemId, userId },
      });

      if (!item) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 404, { reason: 'warehouse_item_not_found' });
      }

      if (item.claimed) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'item_already_claimed' });
      }

      if (item.expiresAt && item.expiresAt < new Date()) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'item_expired' });
      }

      const itemData = (item.data as Record<string, unknown>) ?? {};
      const details: Record<string, unknown> = {};

      switch (item.itemType) {
        case WarehouseItemType.PLAYER_CARD:
        case WarehouseItemType.TEMP_PLAYER: {
          const templateId = itemData.templateId as string | undefined;
          const overwall = (itemData.overwall as number) ?? 100;
          const position = (itemData.position as number) ?? 2;
          const rarity = item.rarity ?? 0;
          const name = item.name;
          const imageUrl = item.imageUrl;
          const days = (itemData.days as number) ?? (item.itemType === WarehouseItemType.TEMP_PLAYER ? 30 : undefined);
          const expiresAt = days ? new Date(Date.now() + days * 86_400_000) : undefined;

          const player = await tx.basePlayer.create({
            data: {
              userId,
              rarity,
              overwall,
              position,
              name,
              imageUrl,
              templateId: templateId ?? null,
              source: item.source,
              expiresAt: expiresAt ?? null,
            },
          });

          await tx.club.updateMany({
            where: { userId },
            data: {
              totalOverwall: {
                increment: overwall,
              },
            },
          });

          details.playerId = player.id;
          details.overwall = overwall;
          details.position = position;
          if (expiresAt) details.expiresAt = expiresAt.toISOString();
          break;
        }

        case WarehouseItemType.STAMINA_BOOST: {
          const effectValue = (itemData.effectValue as number) ?? 100;
          const players = await tx.basePlayer.findMany({
            where: { userId, retiredAt: null },
            select: { id: true, stamina: true },
          });

          for (const p of players) {
            const next = Math.min(STAMINA_MAX, p.stamina + effectValue);
            await tx.basePlayer.update({
              where: { id: p.id },
              data: { stamina: next, staminaUpdatedAt: new Date() },
            });
            await writeStaminaLedger(tx, {
              userId,
              playerKind: 'base',
              playerId: p.id,
              reason: 'shop',
              before: p.stamina,
              after: next,
            });
          }

          details.affectedPlayers = players.length;
          details.effectValue = effectValue;
          break;
        }

        case WarehouseItemType.GMT_PACK: {
          const amount = (itemData.amount as number) ?? 0;
          await applyMgtCredit(
            tx as unknown as Prisma.TransactionClient,
            userId,
            amount,
            MgtTxType.EVENT_REWARD,
            { source: 'warehouse_claim', itemId, itemType: item.itemType },
          );

          details.amount = amount;
          break;
        }

        case WarehouseItemType.OVERWALL_BOOST: {
          const boostAmount = (itemData.boostAmount as number) ?? 100;
          const boostDays = (itemData.boostDays as number) ?? 7;
          const expiresAt = new Date(Date.now() + boostDays * 86_400_000);

          await tx.eventOverwallGrant.create({
            data: {
              userId,
              questId: 'warehouse_boost',
              periodKey: `wh_${item.id}`,
              lineIndex: 0,
              amount: boostAmount,
              expiresAt,
            },
          });

          details.boostAmount = boostAmount;
          details.boostDays = boostDays;
          details.expiresAt = expiresAt.toISOString();
          break;
        }

        case WarehouseItemType.SCOUT_TICKET: {
          const ticketCount = item.quantity ?? (itemData.ticketCount as number) ?? 1;
          details.ticketCount = ticketCount;
          break;
        }

        case WarehouseItemType.CONSUMABLE: {
          details.message = 'consumable_claimed';
          break;
        }

        default:
          throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'unknown_item_type' });
      }

      await tx.warehouseItem.update({
        where: { id: item.id },
        data: { claimed: true, claimedAt: new Date() },
      });

      return {
        itemId: item.id,
        itemType: item.itemType,
        claimed: true,
        details,
      };
    });
  }

  async addItem(tx: Tx, input: {
    userId: string;
    itemType: string;
    name: string;
    description?: string;
    imageUrl?: string;
    rarity?: number;
    quantity?: number;
    data?: Record<string, unknown>;
    source: string;
    sourceRef?: string;
    expiresAt?: Date;
  }) {
    return tx.warehouseItem.create({
      data: {
        userId: input.userId,
        itemType: input.itemType,
        name: input.name,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        rarity: input.rarity ?? 0,
        quantity: input.quantity ?? 1,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
        source: input.source,
        sourceRef: input.sourceRef ?? null,
        expiresAt: input.expiresAt ?? null,
      },
    });
  }

  async addItemFromMarketplace(tx: Tx, input: {
    userId: string;
    playerName: string;
    imageUrl?: string | null;
    rarity: number;
    overwall: number;
    position: number;
    templateId?: string | null;
    listingId: string;
  }) {
    return tx.warehouseItem.create({
      data: {
        userId: input.userId,
        itemType: WarehouseItemType.PLAYER_CARD,
        name: input.playerName,
        imageUrl: input.imageUrl ?? null,
        rarity: input.rarity,
        quantity: 1,
        data: {
          templateId: input.templateId,
          overwall: input.overwall,
          position: input.position,
        },
        source: WarehouseSource.MARKETPLACE,
        sourceRef: input.listingId,
      },
    });
  }

  async addItemFromQuestReward(tx: Tx, input: {
    userId: string;
    itemType: string;
    name: string;
    imageUrl?: string | null;
    rarity?: number;
    data: Record<string, unknown>;
    questId: string;
    periodKey: string;
  }) {
    return tx.warehouseItem.create({
      data: {
        userId: input.userId,
        itemType: input.itemType,
        name: input.name,
        imageUrl: input.imageUrl ?? null,
        rarity: input.rarity ?? 0,
        quantity: 1,
        data: input.data as Prisma.InputJsonValue,
        source: WarehouseSource.QUEST_REWARD,
        sourceRef: `${input.questId}:${input.periodKey}`,
      },
    });
  }

  async listAdminItems(userId: string): Promise<WarehouseItemDTO[]> {
    const items = await this.prisma.warehouseItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return items.map((i) => mapRow(i as unknown as Record<string, unknown>));
  }

  async grantAdminItem(input: {
    userId: string;
    itemType: string;
    name: string;
    description?: string;
    imageUrl?: string;
    rarity?: number;
    quantity?: number;
    data?: Record<string, unknown>;
    expiresAt?: string;
  }): Promise<WarehouseItemDTO> {
    const item = await this.prisma.warehouseItem.create({
      data: {
        userId: input.userId,
        itemType: input.itemType,
        name: input.name,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        rarity: input.rarity ?? 0,
        quantity: input.quantity ?? 1,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
        source: WarehouseSource.ADMIN,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    return mapRow(item as unknown as Record<string, unknown>);
  }

  async removeItem(itemId: string, userId: string): Promise<void> {
    const item = await this.prisma.warehouseItem.findFirst({
      where: { id: itemId, userId },
    });

    if (!item) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 404, { reason: 'warehouse_item_not_found' });
    }

    await this.prisma.warehouseItem.delete({ where: { id: itemId } });
  }
}
