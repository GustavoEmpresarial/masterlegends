import { z } from 'zod';

export const BUILDINGS = ['stadium', 'ct', 'treasurer', 'trophyRoom'] as const;
export type Building = (typeof BUILDINGS)[number];

export const MAX_BUILDING_LEVEL = 10;

export const createClubSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[\p{L}\p{N} _-]+$/u, 'Club name allows letters, digits, space, _ and -'),
});

export const renameClubSchema = createClubSchema;

export const upgradeBuildingParamsSchema = z.object({
  building: z.enum(BUILDINGS),
});

export type CreateClubInput = z.infer<typeof createClubSchema>;
export type RenameClubInput = z.infer<typeof renameClubSchema>;
export type UpgradeBuildingParams = z.infer<typeof upgradeBuildingParamsSchema>;
