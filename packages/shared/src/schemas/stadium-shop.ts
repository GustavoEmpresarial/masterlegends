import { z } from 'zod';

export const STADIUM_SHOP_EFFECT_TYPES = ['stamina_flat', 'stamina_full', 'affiliate_link'] as const;
export type StadiumShopEffectType = (typeof STADIUM_SHOP_EFFECT_TYPES)[number];

export const STADIUM_SHOP_PLATFORMS = ['mercadolivre', 'amazon', 'shopee', 'aliexpress', 'outro'] as const;
export type StadiumShopPlatform = (typeof STADIUM_SHOP_PLATFORMS)[number];

export const stadiumShopBuySchema = z.object({
  itemId: z.string().uuid(),
});

/** Absolute http(s) URL or relative `/uploads/...` path from image upload. */
const shopImageUrlSchema = z
  .string()
  .max(512)
  .refine(
    (v) => v.startsWith('/uploads/') || /^https?:\/\//i.test(v),
    { message: 'imageUrl must be /uploads/... or http(s) URL' },
  );

const externalHttpUrlSchema = z.string().url().max(1024);

function emptyToNull(value: unknown): unknown {
  if (value === '' || value === undefined) return null;
  return value;
}

export const stadiumShopItemCreateSchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
  nameKey: z.string().min(1).max(128),
  effectType: z.enum(STADIUM_SHOP_EFFECT_TYPES),
  effectValue: z.number().int().min(0).max(100).default(0),
  priceUsdc: z.number().min(0),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  imageUrl: z.preprocess(emptyToNull, shopImageUrlSchema.nullable().optional()),
  affiliateUrl: z.preprocess(emptyToNull, externalHttpUrlSchema.nullable().optional()),
  description: z.preprocess(emptyToNull, z.string().max(512).nullable().optional()),
  externalPlatform: z.preprocess(emptyToNull, z.string().max(32).nullable().optional()),
});

export const stadiumShopItemPatchSchema = stadiumShopItemCreateSchema.partial();

export interface StadiumShopItemDTO {
  id: string;
  slug: string;
  nameKey: string;
  effectType: StadiumShopEffectType;
  effectValue: number;
  priceUsdc: number;
  active: boolean;
  sortOrder: number;
  imageUrl: string | null;
  affiliateUrl: string | null;
  description: string | null;
  externalPlatform: string | null;
}

export interface StadiumShopBuyResultDTO {
  item: StadiumShopItemDTO;
  pricePaid: number;
  gmtBalance: number;
  /** Item enviado ao almoxarifado — precisa de claim para aplicar o boost no time. */
  warehouseItemId: string;
}
