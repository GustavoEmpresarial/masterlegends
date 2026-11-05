import { z } from 'zod';
import { MERGE_INPUT_COUNT } from '../economy/merge.js';
import type { ScoutPlayerDTO } from './responses/scout.js';

export const mergeFuseSchema = z.object({
  playerIds: z.array(z.string().uuid()).length(MERGE_INPUT_COUNT),
  /** Merge fees are GMT-only (1:1 with listed fee amounts). */
  payWith: z.literal('gmt').optional(),
});

export type MergeFuseInput = z.infer<typeof mergeFuseSchema>;

export interface MergeTierDTO {
  inputRarity: string;
  outputRarity: string;
  feeUsdc: number;
  effectiveFeeUsdc: number;
  discountPct: number;
  overwallRange: [number, number];
}

export interface MergeRulesDTO {
  inputCount: number;
  tiers: MergeTierDTO[];
  /** Catalog value of a legendary. Not a fusion fee. */
  legendaryValueGmt: number;
}

export interface MergeResultDTO {
  inputRarity: string;
  outputRarity: string;
  burnedIds: string[];
  feeUsdc: number;
  newPlayer: ScoutPlayerDTO;
}
