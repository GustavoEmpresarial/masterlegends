import { z } from 'zod';

export const listingsQuerySchema = z.object({
  rarity: z.enum(['common', 'uncommon', 'rare', 'super-rare', 'epic', 'legendary']).optional(),
  position: z.enum(['GK', 'DEF', 'MID', 'FW', 'LAT']).optional(),
  asset: z.enum(['player', 'nft', 'item']).optional(),
  minOverwall: z.coerce.number().int().min(0).max(1_000_000).optional(),
  maxOverwall: z.coerce.number().int().min(0).max(1_000_000).optional(),
  minLevel: z.coerce.number().int().min(0).max(1_000_000).optional(),
  maxLevel: z.coerce.number().int().min(0).max(1_000_000).optional(),
  minPrice: z.coerce.number().min(0).max(10_000_000).optional(),
  maxPrice: z.coerce.number().min(0).max(10_000_000).optional(),
  sortBy: z.enum(['price', 'overwall']).default('price'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export const listItemSchema = z
  .object({
    basePlayerId: z.string().uuid().optional(),
    tokenId: z.string().regex(/^\d+$/).optional(),
    price: z.coerce.number().positive().max(10_000_000),
  })
  .refine((value) => Number(Boolean(value.basePlayerId)) + Number(Boolean(value.tokenId)) === 1, {
    message: 'Informe um jogador ou um NFT',
  });

export const buyListingParamsSchema = z.object({
  listingId: z.string().uuid(),
});

export const cancelListingParamsSchema = z.object({
  listingId: z.string().uuid(),
});

export const updateListingPriceSchema = z.object({
  price: z.coerce.number().positive().max(10_000_000),
});

export type ListingsQuery = z.infer<typeof listingsQuerySchema>;
export type ListItemInput = z.infer<typeof listItemSchema>;
