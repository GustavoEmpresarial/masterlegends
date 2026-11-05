import { z } from 'zod';
import { SCOUT_MAX_PER_TX } from '../economy/scout.js';

/** Client may only send quantity — rarity/overwall are server-authoritative. */
export const mintSchema = z
  .object({
    quantity: z.coerce.number().int().min(1).max(SCOUT_MAX_PER_TX),
  })
  .strict();

export type MintInput = z.infer<typeof mintSchema>;
