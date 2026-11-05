import { z } from 'zod';

export const GearSlot = {
  BOOTS: 'boots',
  GLOVES: 'gloves',
  SHINGUARDS: 'shinguards',
} as const;
export type GearSlotType = (typeof GearSlot)[keyof typeof GearSlot];

export const GEAR_SLOTS = [GearSlot.BOOTS, GearSlot.GLOVES, GearSlot.SHINGUARDS] as const;

/** Soft caps for admin-configured gear. */
export const GEAR_CAPS = {
  owBonusMax: 500,
  priceGmtMax: 100_000,
  rarityMax: 5,
} as const;

const gearImageUrlSchema = z
  .string()
  .max(512)
  .refine(
    (v) => v.startsWith('/uploads/') || /^https?:\/\//i.test(v),
    { message: 'must be /uploads/... or http(s) URL' },
  );

function emptyToNull(value: unknown): unknown {
  if (value === '' || value === undefined) return null;
  return value;
}

export const gearCatalogUpsertSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_-]+$/),
  nameKey: z.string().min(1).max(128),
  slot: z.enum(GEAR_SLOTS).default(GearSlot.BOOTS),
  rarity: z.number().int().min(0).max(GEAR_CAPS.rarityMax),
  owBonus: z.number().int().min(0).max(GEAR_CAPS.owBonusMax),
  priceGmt: z.number().min(0).max(GEAR_CAPS.priceGmtMax),
  imageUrl: z.preprocess(emptyToNull, gearImageUrlSchema.nullable()),
  description: z.preprocess(emptyToNull, z.string().max(512).nullable()),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const gearCatalogPatchSchema = gearCatalogUpsertSchema.partial();

export const gearBuySchema = z.object({
  catalogItemId: z.string().uuid(),
});

export const gearEquipSchema = z.object({
  userGearId: z.string().uuid(),
  playerId: z.string().min(1).max(64),
  kind: z.enum(['base', 'nft']),
});

export const gearUnequipSchema = z.object({
  playerId: z.string().min(1).max(64),
  kind: z.enum(['base', 'nft']),
  slot: z.enum(GEAR_SLOTS),
});

export type GearCatalogUpsert = z.infer<typeof gearCatalogUpsertSchema>;
export type GearCatalogPatch = z.infer<typeof gearCatalogPatchSchema>;

export interface GearCatalogItemDTO {
  id: string;
  slug: string;
  nameKey: string;
  slot: GearSlotType;
  rarity: number;
  owBonus: number;
  priceGmt: number;
  imageUrl: string | null;
  description: string | null;
  active: boolean;
  sortOrder: number;
}

export interface EquippedGearDTO {
  slot: GearSlotType;
  userGearId: string;
  catalogItemId: string;
  nameKey: string;
  rarity: number;
  owBonus: number;
  imageUrl: string | null;
}

export interface UserGearDTO {
  id: string;
  catalogItemId: string;
  nameKey: string;
  slot: GearSlotType;
  rarity: number;
  owBonus: number;
  imageUrl: string | null;
  source: string;
  acquiredAt: string;
  equippedOn?: {
    playerId: string;
    playerKind: 'base' | 'nft';
  } | null;
}

export interface GearBagResponse {
  items: UserGearDTO[];
  total: number;
}

export interface GearBuyResultDTO {
  item: UserGearDTO;
  pricePaid: number;
  gmtBalance: number;
}
