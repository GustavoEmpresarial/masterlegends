import type { PrismaClient } from '@prisma/client';
import {
  ErrorCode,
  GearSlot,
  MgtTxType,
  gearBuySchema,
  gearCatalogPatchSchema,
  gearCatalogUpsertSchema,
  gearEquipSchema,
  gearUnequipSchema,
  type GearBagResponse,
  type GearBuyResultDTO,
  type GearCatalogItemDTO,
  type UserGearDTO,
} from '@mll/shared';
import { AppError } from '../../common/lib/errors.js';
import { applyMgtDebit } from '../wallet/mgt-ledger.js';
import { ClubRepository } from '../club/club.repository.js';

function mapCatalog(row: {
  id: string;
  slug: string;
  nameKey: string;
  slot: string;
  rarity: number;
  owBonus: number;
  priceGmt: { toString(): string } | number;
  imageUrl: string | null;
  description: string | null;
  active: boolean;
  sortOrder: number;
}): GearCatalogItemDTO {
  return {
    id: row.id,
    slug: row.slug,
    nameKey: row.nameKey,
    slot: row.slot as GearCatalogItemDTO['slot'],
    rarity: row.rarity,
    owBonus: row.owBonus,
    priceGmt: Number(row.priceGmt),
    imageUrl: row.imageUrl,
    description: row.description,
    active: row.active,
    sortOrder: row.sortOrder,
  };
}

export class GearService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clubRepo: ClubRepository,
  ) {}

  async listActiveCatalog(): Promise<GearCatalogItemDTO[]> {
    const rows = await this.prisma.gearCatalogItem.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { rarity: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(mapCatalog);
  }

  async listAllCatalog(): Promise<GearCatalogItemDTO[]> {
    const rows = await this.prisma.gearCatalogItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { rarity: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(mapCatalog);
  }

  async createCatalog(raw: unknown): Promise<GearCatalogItemDTO> {
    const body = gearCatalogUpsertSchema.parse(raw);
    const row = await this.prisma.gearCatalogItem.create({
      data: {
        slug: body.slug,
        nameKey: body.nameKey,
        slot: body.slot ?? GearSlot.BOOTS,
        rarity: body.rarity,
        owBonus: body.owBonus,
        priceGmt: body.priceGmt,
        imageUrl: body.imageUrl ?? null,
        description: body.description ?? null,
        active: body.active ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return mapCatalog(row);
  }

  async patchCatalog(id: string, raw: unknown): Promise<GearCatalogItemDTO> {
    const body = gearCatalogPatchSchema.parse(raw);
    const existing = await this.prisma.gearCatalogItem.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCode.GEAR_NOT_FOUND, 404);
    const row = await this.prisma.gearCatalogItem.update({
      where: { id },
      data: {
        ...(body.slug != null ? { slug: body.slug } : {}),
        ...(body.nameKey != null ? { nameKey: body.nameKey } : {}),
        ...(body.slot != null ? { slot: body.slot } : {}),
        ...(body.rarity != null ? { rarity: body.rarity } : {}),
        ...(body.owBonus != null ? { owBonus: body.owBonus } : {}),
        ...(body.priceGmt != null ? { priceGmt: body.priceGmt } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.active != null ? { active: body.active } : {}),
        ...(body.sortOrder != null ? { sortOrder: body.sortOrder } : {}),
      },
    });
    return mapCatalog(row);
  }

  async buy(userId: string, raw: unknown): Promise<GearBuyResultDTO> {
    const body = gearBuySchema.parse(raw);
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const catalog = await this.prisma.gearCatalogItem.findFirst({
      where: { id: body.catalogItemId, active: true },
    });
    if (!catalog) throw new AppError(ErrorCode.GEAR_NOT_FOUND, 404);

    const price = Number(catalog.priceGmt);

    const result = await this.prisma.$transaction(async (tx) => {
      await applyMgtDebit(tx, userId, price, MgtTxType.GEAR_SHOP, {
        catalogItemId: catalog.id,
        slug: catalog.slug,
      });

      const owned = await tx.userGear.create({
        data: {
          userId,
          catalogItemId: catalog.id,
          source: 'shop',
        },
        include: { catalogItem: true, equip: true },
      });

      const balance = await tx.mGTBalance.findUnique({ where: { userId } });
      return {
        owned,
        gmtBalance: Number(balance?.amount ?? 0),
      };
    });

    return {
      item: this.mapUserGear(result.owned),
      pricePaid: price,
      gmtBalance: result.gmtBalance,
    };
  }

  async getBag(userId: string): Promise<GearBagResponse> {
    const rows = await this.prisma.userGear.findMany({
      where: { userId },
      include: { catalogItem: true, equip: true },
      orderBy: { acquiredAt: 'desc' },
    });
    const items = rows.map((r) => this.mapUserGear(r));
    return { items, total: items.length };
  }

  async equip(userId: string, raw: unknown) {
    const body = gearEquipSchema.parse(raw);
    await this.assertOwnsPlayer(userId, body.playerId, body.kind);

    const gear = await this.prisma.userGear.findFirst({
      where: { id: body.userGearId, userId },
      include: { catalogItem: true, equip: true },
    });
    if (!gear) throw new AppError(ErrorCode.GEAR_NOT_FOUND, 404);

    const slot = gear.catalogItem.slot;

    await this.prisma.$transaction(async (tx) => {
      // Unequip this gear if already on another player
      if (gear.equip) {
        await tx.playerGearEquip.delete({ where: { id: gear.equip.id } });
      }

      // Clear existing slot on target player
      await tx.playerGearEquip.deleteMany({
        where: {
          userId,
          playerId: body.playerId,
          playerKind: body.kind,
          slot,
        },
      });

      await tx.playerGearEquip.create({
        data: {
          userId,
          playerId: body.playerId,
          playerKind: body.kind,
          slot,
          userGearId: gear.id,
        },
      });
    });

    return this.getBag(userId);
  }

  async unequip(userId: string, raw: unknown) {
    const body = gearUnequipSchema.parse(raw);
    await this.prisma.playerGearEquip.deleteMany({
      where: {
        userId,
        playerId: body.playerId,
        playerKind: body.kind,
        slot: body.slot,
      },
    });
    return this.getBag(userId);
  }

  /** Map of `kind:playerId` → total equipped owBonus for a user. */
  async getEquippedBonusByPlayer(userId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.playerGearEquip.findMany({
      where: { userId },
      include: { userGear: { include: { catalogItem: true } } },
    });
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = `${row.playerKind}:${row.playerId}`;
      map.set(key, (map.get(key) ?? 0) + row.userGear.catalogItem.owBonus);
    }
    return map;
  }

  /** Sum of equipped gear OW for the given lineup player ids. */
  async sumEquippedBonusForPlayers(
    userId: string,
    players: { playerId: string; kind: 'base' | 'nft' }[],
  ): Promise<number> {
    if (players.length === 0) return 0;
    const or = players.map((p) => ({
      playerId: p.playerId,
      playerKind: p.kind,
    }));
    const rows = await this.prisma.playerGearEquip.findMany({
      where: { userId, OR: or },
      include: { userGear: { include: { catalogItem: true } } },
    });
    return rows.reduce((sum, r) => sum + r.userGear.catalogItem.owBonus, 0);
  }

  async getEquippedForPlayers(userId: string) {
    return this.prisma.playerGearEquip.findMany({
      where: { userId },
      include: { userGear: { include: { catalogItem: true } } },
    });
  }

  private mapUserGear(row: {
    id: string;
    catalogItemId: string;
    source: string;
    acquiredAt: Date;
    catalogItem: {
      nameKey: string;
      slot: string;
      rarity: number;
      owBonus: number;
      imageUrl: string | null;
    };
    equip: { playerId: string; playerKind: string } | null;
  }): UserGearDTO {
    return {
      id: row.id,
      catalogItemId: row.catalogItemId,
      nameKey: row.catalogItem.nameKey,
      slot: row.catalogItem.slot as UserGearDTO['slot'],
      rarity: row.catalogItem.rarity,
      owBonus: row.catalogItem.owBonus,
      imageUrl: row.catalogItem.imageUrl,
      source: row.source,
      acquiredAt: row.acquiredAt.toISOString(),
      equippedOn: row.equip
        ? {
            playerId: row.equip.playerId,
            playerKind: row.equip.playerKind as 'base' | 'nft',
          }
        : null,
    };
  }

  private async assertOwnsPlayer(userId: string, playerId: string, kind: 'base' | 'nft') {
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    if (kind === 'base') {
      const p = await this.prisma.basePlayer.findFirst({ where: { id: playerId, userId } });
      if (!p) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 404);
      return;
    }
    const wallet = club.user?.wallet ?? null;
    if (!wallet) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 404);
    const nft = await this.prisma.playerCache.findFirst({
      where: { tokenId: BigInt(playerId), ownerWallet: wallet },
    });
    if (!nft) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 404);
  }
}
