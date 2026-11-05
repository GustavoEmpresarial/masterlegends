import type { PrismaClient } from '@prisma/client';
import type { StadiumShopBuyResultDTO, StadiumShopItemDTO } from '@mll/shared';
import { MgtTxType, WarehouseItemType, WarehouseSource, stadiumShopBuySchema } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { STAMINA_MAX } from '../../common/lib/stamina.js';
import { ClubRepository } from '../club/club.repository.js';
import { applyMgtDebit } from '../wallet/mgt-ledger.js';
import { WarehouseService } from '../warehouse/warehouse.service.js';

function mapItem(row: {
  id: string;
  slug: string;
  nameKey: string;
  effectType: string;
  effectValue: number;
  priceUsdc: { toString(): string };
  active: boolean;
  sortOrder: number;
  imageUrl?: string | null;
  affiliateUrl?: string | null;
  description?: string | null;
  externalPlatform?: string | null;
}): StadiumShopItemDTO {
  return {
    id: row.id,
    slug: row.slug,
    nameKey: row.nameKey,
    effectType: row.effectType as StadiumShopItemDTO['effectType'],
    effectValue: row.effectValue,
    priceUsdc: Number(row.priceUsdc),
    active: row.active,
    sortOrder: row.sortOrder,
    imageUrl: row.imageUrl ?? null,
    affiliateUrl: row.affiliateUrl ?? null,
    description: row.description ?? null,
    externalPlatform: row.externalPlatform ?? null,
  };
}

export class StadiumShopService {
  private readonly warehouse: WarehouseService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly clubRepo: ClubRepository,
  ) {
    this.warehouse = new WarehouseService(prisma);
  }

  async listActive(): Promise<StadiumShopItemDTO[]> {
    const rows = await this.prisma.stadiumShopItem.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(mapItem);
  }

  async listAll(): Promise<StadiumShopItemDTO[]> {
    const rows = await this.prisma.stadiumShopItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(mapItem);
  }

  /** Compra na Lojinha: debita GMT e envia o item ao almoxarifado (claim aplica o boost no time todo). */
  async buy(userId: string, raw: unknown): Promise<StadiumShopBuyResultDTO> {
    const body = stadiumShopBuySchema.parse(raw);
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const item = await this.prisma.stadiumShopItem.findFirst({
      where: { id: body.itemId, active: true },
    });
    if (!item) throw new AppError(ErrorCode.SHOP_ITEM_NOT_FOUND, 404);
    if (item.effectType === 'affiliate_link') {
      throw new AppError(ErrorCode.SHOP_ITEM_NOT_FOUND, 400, { reason: 'not_purchasable' });
    }

    const price = Number(item.priceUsdc);
    const effectValue = item.effectType === 'stamina_full' ? STAMINA_MAX : item.effectValue;

    const result = await this.prisma.$transaction(async (tx) => {
      await applyMgtDebit(tx, userId, price, MgtTxType.STADIUM_SHOP, {
        itemId: item.id,
        slug: item.slug,
      });

      const warehouseItem = await this.warehouse.addItem(tx, {
        userId,
        itemType: WarehouseItemType.STAMINA_BOOST,
        name: item.nameKey,
        description: item.description ?? undefined,
        imageUrl: item.imageUrl ?? undefined,
        quantity: 1,
        data: { effectValue, effectType: item.effectType },
        source: WarehouseSource.STADIUM_SHOP,
        sourceRef: item.id,
      });

      const balance = await tx.mGTBalance.findUnique({ where: { userId } });

      return {
        warehouseItemId: warehouseItem.id,
        gmtBalance: Number(balance?.amount ?? 0),
      };
    });

    return {
      item: mapItem(item),
      pricePaid: price,
      gmtBalance: result.gmtBalance,
      warehouseItemId: result.warehouseItemId,
    };
  }

  async createItem(data: {
    slug: string;
    nameKey: string;
    effectType: string;
    effectValue?: number;
    priceUsdc: number;
    active?: boolean;
    sortOrder?: number;
    imageUrl?: string | null;
    affiliateUrl?: string | null;
    description?: string | null;
    externalPlatform?: string | null;
  }) {
    const row = await this.prisma.stadiumShopItem.create({
      data: {
        slug: data.slug,
        nameKey: data.nameKey,
        effectType: data.effectType,
        effectValue: data.effectValue ?? 0,
        priceUsdc: data.priceUsdc,
        active: data.active ?? true,
        sortOrder: data.sortOrder ?? 0,
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.affiliateUrl !== undefined ? { affiliateUrl: data.affiliateUrl } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.externalPlatform !== undefined ? { externalPlatform: data.externalPlatform } : {}),
      },
    });
    return mapItem(row);
  }

  async patchItem(
    id: string,
    data: Partial<{
      slug: string;
      nameKey: string;
      effectType: string;
      effectValue: number;
      priceUsdc: number;
      active: boolean;
      sortOrder: number;
      imageUrl: string | null;
      affiliateUrl: string | null;
      description: string | null;
      externalPlatform: string | null;
    }>,
  ) {
    const existing = await this.prisma.stadiumShopItem.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCode.SHOP_ITEM_NOT_FOUND, 404);
    const row = await this.prisma.stadiumShopItem.update({
      where: { id },
      data,
    });
    return mapItem(row);
  }
}
