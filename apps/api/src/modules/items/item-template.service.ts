import type { PrismaClient, ItemTemplate } from '@prisma/client';
import type { ItemTemplateDTO } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { secureRandom } from '../../common/lib/secure-random.js';
import { deleteItemImage } from '../../common/lib/uploads.js';

export interface CreateTemplateInput {
  name: string;
  imageUrl: string;
  rarity: number;
  position: number;
  overwall: number;
  weight: number;
  active: boolean;
}

export interface PatchTemplateInput {
  name?: string;
  imageUrl?: string;
  rarity?: number;
  position?: number;
  overwall?: number;
  weight?: number;
  active?: boolean;
}

function toDTO(row: ItemTemplate): ItemTemplateDTO {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.imageUrl,
    rarity: row.rarity,
    position: row.position,
    overwall: row.overwall,
    weight: row.weight,
    active: row.active,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class ItemTemplateService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filters: {
    rarity?: number;
    active?: boolean;
    limit?: number;
  } = {}): Promise<ItemTemplateDTO[]> {
    const rows = await this.prisma.itemTemplate.findMany({
      where: {
        ...(filters.rarity !== undefined ? { rarity: filters.rarity } : {}),
        ...(filters.active !== undefined ? { active: filters.active } : {}),
      },
      orderBy: [{ rarity: 'asc' }, { createdAt: 'desc' }],
      take: Math.min(500, Math.max(1, filters.limit ?? 200)),
    });
    return rows.map(toDTO);
  }

  async getById(id: string): Promise<ItemTemplateDTO> {
    const row = await this.prisma.itemTemplate.findUnique({ where: { id } });
    if (!row) throw new AppError(ErrorCode.ITEM_TEMPLATE_NOT_FOUND, 404);
    return toDTO(row);
  }

  async create(input: CreateTemplateInput, adminLogin: string): Promise<ItemTemplateDTO> {
    const row = await this.prisma.itemTemplate.create({
      data: { ...input, createdBy: adminLogin },
    });
    return toDTO(row);
  }

  async update(id: string, patch: PatchTemplateInput): Promise<ItemTemplateDTO> {
    const existing = await this.prisma.itemTemplate.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCode.ITEM_TEMPLATE_NOT_FOUND, 404);

    if (patch.imageUrl && patch.imageUrl !== existing.imageUrl) {
      await deleteItemImage(existing.imageUrl);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.itemTemplate.update({
        where: { id },
        data: patch,
      });

      const playerPatch: {
        overwall?: number;
        imageUrl?: string;
        name?: string;
        position?: number;
        rarity?: number;
      } = {};
      if (patch.overwall !== undefined) playerPatch.overwall = patch.overwall;
      if (patch.imageUrl !== undefined) playerPatch.imageUrl = patch.imageUrl;
      if (patch.name !== undefined) playerPatch.name = patch.name;
      if (patch.position !== undefined) playerPatch.position = patch.position;
      if (patch.rarity !== undefined) playerPatch.rarity = patch.rarity;

      if (Object.keys(playerPatch).length > 0) {
        // Sync players linked to this template
        await tx.basePlayer.updateMany({
          where: { templateId: id },
          data: playerPatch,
        });

        // Also sync orphan players (no templateId) with same rarity when overwall changes
        if (patch.overwall !== undefined) {
          await tx.basePlayer.updateMany({
            where: { templateId: null, rarity: existing.rarity },
            data: { overwall: patch.overwall },
          });
        }

        // Sync active listings overwall to stay consistent with their player
        if (patch.overwall !== undefined) {
          await tx.listing.updateMany({
            where: {
              basePlayer: { templateId: id },
              active: true,
            },
            data: { overwall: patch.overwall },
          });
          // Orphan-player listings
          await tx.listing.updateMany({
            where: {
              basePlayer: { templateId: null, rarity: existing.rarity },
              active: true,
            },
            data: { overwall: patch.overwall },
          });
        }

        if (patch.overwall !== undefined) {
          const owners = await tx.basePlayer.findMany({
            where: {
              OR: [
                { templateId: id },
                { templateId: null, rarity: existing.rarity },
              ],
            },
            select: { userId: true },
            distinct: ['userId'],
          });
          for (const { userId } of owners) {
            const agg = await tx.basePlayer.aggregate({
              where: { userId },
              _sum: { overwall: true },
            });
            await tx.club.updateMany({
              where: { userId },
              data: { totalOverwall: agg._sum.overwall ?? 0 },
            });
          }
        }
      }

      return updated;
    });

    return toDTO(row);
  }

  async setActive(id: string, active: boolean): Promise<ItemTemplateDTO> {
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.itemTemplate.update({
        where: { id },
        data: { active },
      });
      if (!active) {
        await tx.listing.updateMany({
          where: { active: true, basePlayer: { templateId: id } },
          data: { active: false },
        });
        await tx.basePlayer.updateMany({
          where: { templateId: id, listed: true },
          data: { listed: false },
        });
      }
      return updated;
    });
    return toDTO(row);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.itemTemplate.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCode.ITEM_TEMPLATE_NOT_FOUND, 404);
    await this.prisma.itemTemplate.delete({ where: { id } });
    await deleteItemImage(existing.imageUrl);
  }

  /**
   * Rarities that have at least one active template in the scout pool.
   */
  async listActiveRarities(): Promise<number[]> {
    const rows = await this.prisma.itemTemplate.groupBy({
      by: ['rarity'],
      where: { active: true, weight: { gt: 0 } },
    });
    return rows.map((r) => r.rarity).sort((a, b) => a - b);
  }

  /**
   * Picks one active template for the given rarity, weighted by `weight`.
   * Returns null when no active template exists for that rarity.
   */
  async pickForRarity(
    rarity: number,
    rand: () => number = secureRandom,
  ): Promise<ItemTemplate | null> {
    const candidates = await this.prisma.itemTemplate.findMany({
      where: { rarity, active: true, weight: { gt: 0 } },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        rarity: true,
        position: true,
        overwall: true,
        weight: true,
        active: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (candidates.length === 0) return null;

    const totalWeight = candidates.reduce((sum, c) => sum + Math.max(0, c.weight), 0);
    if (totalWeight <= 0) return null;

    let roll = rand() * totalWeight;
    for (const c of candidates) {
      roll -= Math.max(0, c.weight);
      if (roll < 0) return c as ItemTemplate;
    }
    return candidates[candidates.length - 1] as ItemTemplate;
  }
}
