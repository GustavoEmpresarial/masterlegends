import { z } from 'zod';

export const playerStakeParamsSchema = z.object({
  kind: z.enum(['base', 'nft']),
  playerId: z.string().min(1).max(64),
});

export type PlayerStakeParams = z.infer<typeof playerStakeParamsSchema>;

export interface PlayerStakeResultDTO {
  kind: 'base' | 'nft';
  playerId: string;
  staked: boolean;
  stakeGmt: number;
  gmtLocked: number;
  gmtBalance: number;
  /** Percent of the stake burned on this unstake. 0 after 30 full days. */
  penaltyPercent?: number;
  penaltyGmt?: number;
  returnedGmt?: number;
}
