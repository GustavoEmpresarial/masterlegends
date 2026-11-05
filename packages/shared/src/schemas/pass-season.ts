import { z } from 'zod';

export const passRewardTypeSchema = z.enum(['usdc', 'player', 'catalog_item', 'gear', 'shop_item', 'cosmetic', 'ticket']);

export const passMissionCategorySchema = z.enum(['daily', 'weekly']);
export const passMissionDifficultySchema = z.enum(['easy', 'medium', 'hard', 'elite']);

export const passMissionEventSchema = z.enum([
  'login',
  'lineup_save',
  'training',
  'pvp_match_played',
  'pvp_match_won',
  'pvp_goals',
  'penalty_goals',
  'tournament_knockout',
  'evolve_player',
  'trade_player',
  'pass_claim',
  'market_visit',
]);

export const PASS_CATALOG_REWARD_TYPES = ['catalog_item', 'gear', 'shop_item'] as const;

function validateCatalogReward(value: { rewardType: string; rewardItemId?: string; usdcAmount?: number }, ctx: z.RefinementCtx) {
  if ((PASS_CATALOG_REWARD_TYPES as readonly string[]).includes(value.rewardType) && !value.rewardItemId) {
    ctx.addIssue({ code: 'custom', path: ['rewardItemId'], message: 'Selecione um item do catálogo para este prêmio.' });
  }
  if (value.rewardType === 'usdc' && !(Number(value.usdcAmount) > 0)) {
    ctx.addIssue({ code: 'custom', path: ['usdcAmount'], message: 'Informe um valor maior que zero para o prêmio em saldo.' });
  }
}

export const passLevelConfigSchema = z.object({
  level: z.number().int().min(1).max(100),
  xpRequired: z.number().int().min(0),
  rewardType: passRewardTypeSchema,
  rewardLabel: z.string().min(1).max(128),
  usdcAmount: z.number().nonnegative().optional(),
  playerRarity: z.number().int().min(0).max(5).optional(),
  rewardItemId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(100).optional(),
  rewardImageUrl: z.string().max(512).nullable().optional(),
}).superRefine(validateCatalogReward);

export const passMissionConfigSchema = z.object({
  id: z.string().min(1).max(32),
  label: z.string().min(1).max(128),
  xp: z.number().int().positive(),
  target: z.number().int().positive(),
  category: passMissionCategorySchema.default('daily'),
  difficulty: passMissionDifficultySchema.default('easy'),
  eventType: passMissionEventSchema,
});

export const passRewardBlockSchema = z.object({
  fromLevel: z.number().int().min(1).max(100),
  toLevel: z.number().int().min(1).max(100),
  rewardType: passRewardTypeSchema,
  rewardLabel: z.string().min(1).max(128),
  usdcAmount: z.number().nonnegative().optional(),
  playerRarity: z.number().int().min(0).max(5).optional(),
  rewardItemId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(100).optional(),
  rewardImageUrl: z.string().max(512).nullable().optional(),
}).refine((b) => b.toLevel >= b.fromLevel, { message: 'toLevel must be >= fromLevel' }).superRefine(validateCatalogReward);

export const passRewardBlocksSchema = z.array(passRewardBlockSchema).max(20).superRefine((blocks, ctx) => {
  const sorted = [...blocks].sort((a, b) => a.fromLevel - b.fromLevel);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].fromLevel <= sorted[i - 1].toLevel) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'reward blocks overlap' });
      break;
    }
  }
});

export const passRankConfigItemSchema = z.object({
  rank: z.enum(['bronze', 'prata', 'ouro', 'diamante', 'lendario']),
  minLevel: z.number().int().min(1),
  maxLevel: z.number().int().min(1),
  bonusPct: z.number().min(0).max(2),
});

export const passRankConfigSchema = z.array(passRankConfigItemSchema).length(5);

export const DEFAULT_PASS_RANK_CONFIG: PassRankConfigDTO = [
  { rank: 'bronze', minLevel: 1, maxLevel: 10, bonusPct: 0 },
  { rank: 'prata', minLevel: 11, maxLevel: 25, bonusPct: 0.05 },
  { rank: 'ouro', minLevel: 26, maxLevel: 50, bonusPct: 0.1 },
  { rank: 'diamante', minLevel: 51, maxLevel: 80, bonusPct: 0.15 },
  { rank: 'lendario', minLevel: 81, maxLevel: 100, bonusPct: 0.2 },
];

export const passLevelsSchema = z.array(passLevelConfigSchema).max(100).superRefine((levels, ctx) => {
  const seen = new Set<number>();
  for (const [index, level] of levels.entries()) {
    if (seen.has(level.level)) ctx.addIssue({ code: 'custom', path: [index, 'level'], message: 'Cada nível deve ter um único prêmio.' });
    seen.add(level.level);
  }
});
export const passMissionsSchema = z.array(passMissionConfigSchema).max(40);

const passSeasonBaseSchema = z.object({
  name: z.string().min(1).max(64),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  premiumPriceUsdc: z.number().nonnegative(),
  active: z.boolean().default(false),
  levels: passLevelsSchema.refine(levels => levels.length > 0, 'Adicione pelo menos um nível com prêmio.'),
  missions: passMissionsSchema,
  rewardBlocks: passRewardBlocksSchema.optional().default([]),
});

export const passSeasonCreateSchema = passSeasonBaseSchema.refine(
  (v) => new Date(v.endsAt) > new Date(v.startsAt),
  {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  },
);

export const passSeasonPatchSchema = passSeasonBaseSchema.partial().refine(
  (v) => {
    if (v.startsAt && v.endsAt) {
      return new Date(v.endsAt) > new Date(v.startsAt);
    }
    return true;
  },
  {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  },
);

export type PassRewardType = z.infer<typeof passRewardTypeSchema>;
export type PassLevelConfigDTO = z.infer<typeof passLevelConfigSchema>;
export type PassMissionConfigDTO = z.infer<typeof passMissionConfigSchema>;
export type PassMissionCategory = z.infer<typeof passMissionCategorySchema>;
export type PassMissionDifficulty = z.infer<typeof passMissionDifficultySchema>;
export type PassMissionEvent = z.infer<typeof passMissionEventSchema>;
export type PassRewardBlockDTO = z.infer<typeof passRewardBlockSchema>;
export type PassRankConfigItemDTO = z.infer<typeof passRankConfigItemSchema>;
export type PassRankConfigDTO = PassRankConfigItemDTO[];

export interface PassSeasonDTO {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  premiumPriceUsdc: number;
  levels: PassLevelConfigDTO[];
  missions: PassMissionConfigDTO[];
  rewardBlocks: PassRewardBlockDTO[];
}

export function parsePassLevels(raw: unknown): PassLevelConfigDTO[] {
  return passLevelsSchema.parse(raw ?? []);
}

export function parsePassMissions(raw: unknown): PassMissionConfigDTO[] {
  return passMissionsSchema.parse(raw ?? []);
}

export function parsePassRewardBlocks(raw: unknown): PassRewardBlockDTO[] {
  return passRewardBlocksSchema.parse(raw ?? []);
}

export function parsePassRankConfig(raw: unknown): PassRankConfigDTO {
  const result = passRankConfigSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_PASS_RANK_CONFIG;
}

export function findRankForLevel(
  level: number,
  cfg: PassRankConfigDTO = DEFAULT_PASS_RANK_CONFIG,
): PassRankConfigItemDTO {
  return (
    cfg.find((r) => level >= r.minLevel && level <= r.maxLevel) ??
    cfg[0] ??
    { rank: 'bronze', minLevel: 1, maxLevel: 10, bonusPct: 0 }
  );
}

export function findRewardBlockForLevel(
  level: number,
  blocks: PassRewardBlockDTO[],
): PassRewardBlockDTO | null {
  return blocks.find((b) => level >= b.fromLevel && level <= b.toLevel) ?? null;
}

export interface PassRewardCatalogItemDTO {
  id: string;
  rewardType: 'catalog_item' | 'gear' | 'shop_item';
  name: string;
  imageUrl: string | null;
  description: string;
}
