import { z } from 'zod';

export const STADIUM_CONTRACT_VERSION = 'mll-campo-v1' as const;

/** Paid stadium: a full squad of 11 at the stadium's rarity or higher. */
export const STADIUM_LICENSE_RARE_STARTERS_REQUIRED = 11;
/**
 * Rarity index: 0=common, 1=uncommon, 2=rare, 3=super-rare, 4=epic, 5=legendary.
 * Common never unlocks a stadium. The first field starts at uncommon.
 */
export const STADIUM_LICENSE_MIN_RARITY_INDEX = 1;

export const STADIUM_RARITY_LABELS = [
  'Comum',
  'Incomum',
  'Raro',
  'Super raro',
  'Épico',
  'Lendário',
] as const;

/** sortOrder 0 → uncommon. Each next stadium asks for the next rarity. */
export function stadiumMinRarityIndex(sortOrder: number): number {
  const step = Number.isFinite(sortOrder) ? Math.max(0, Math.floor(sortOrder)) : 0;
  return Math.min(STADIUM_RARITY_LABELS.length - 1, step + STADIUM_LICENSE_MIN_RARITY_INDEX);
}

export function stadiumRarityLabel(index: number): string {
  const i = Math.min(STADIUM_RARITY_LABELS.length - 1, Math.max(0, Math.floor(index)));
  return STADIUM_RARITY_LABELS[i] ?? 'Incomum';
}

export const stadiumLicenseStatusSchema = z.enum(['purchased', 'signed']);
export type StadiumLicenseStatus = z.infer<typeof stadiumLicenseStatusSchema>;

export const stadiumLicenseCatalogItemSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string(),
  imageUrl: z.string(),
  priceUsdc: z.number().nullable(),
  isFree: z.boolean(),
  isDefault: z.boolean(),
  farmBonusPct: z.number(),
  slotCount: z.number().int(),
  licenseStatus: stadiumLicenseStatusSchema.nullable(),
  isCurrent: z.boolean(),
  purchasedAt: z.string().nullable(),
  signedAt: z.string().nullable(),
  contractVersion: z.string().nullable(),
  requireRareStarters: z.number().int(),
  requireMinRarity: z.number().int(),
  squadCount: z.number().int(),
  requireMinOverwall: z.number().int(),
  requireOwnedTemplateId: z.string().uuid().nullable(),
  requireOwnedTemplateName: z.string().nullable(),
  requirementNote: z.string().nullable(),
  meetsRequirements: z.boolean(),
  requirementBlockers: z.array(z.string()),
});

export type StadiumLicenseCatalogItemDTO = z.infer<typeof stadiumLicenseCatalogItemSchema>;

export const stadiumLicenseCatalogSchema = z.object({
  clubName: z.string(),
  usdcBalance: z.number(),
  gmtBalance: z.number(),
  contractVersion: z.literal(STADIUM_CONTRACT_VERSION),
  rareStartersRequired: z.number().int(),
  rareStartersCount: z.number().int(),
  meetsRareTeamRequirement: z.boolean(),
  currentOverwall: z.number().int(),
  items: z.array(stadiumLicenseCatalogItemSchema),
});

export type StadiumLicenseCatalogDTO = z.infer<typeof stadiumLicenseCatalogSchema>;

export const stadiumLicenseTemplateIdParamsSchema = z.object({
  templateId: z.string().uuid(),
});
