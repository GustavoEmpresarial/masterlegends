import { z } from 'zod';

export const claimRewardParamsSchema = z.object({
  level: z.coerce.number().int().min(1).max(100),
});

export type ClaimRewardParams = z.infer<typeof claimRewardParamsSchema>;
