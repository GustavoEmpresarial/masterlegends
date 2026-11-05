import { z } from 'zod';

export const QuestKind = {
  EVENT_TASK: 'event_task',
  DAILY_TASK: 'daily_task',
  WEEKLY_TASK: 'weekly_task',
  ACHIEVEMENT: 'achievement',
} as const;
export type QuestKindType = (typeof QuestKind)[keyof typeof QuestKind];

export const QuestPeriod = {
  NONE: 'none',
  DAILY: 'daily',
  WEEKLY: 'weekly',
} as const;
export type QuestPeriodType = (typeof QuestPeriod)[keyof typeof QuestPeriod];

export const QuestTrigger = {
  LOGIN: 'login',
  CHECKIN_CLAIM: 'checkin_claim',
  LINEUP_SAVE: 'lineup_save',
  SCOUT_MINT: 'scout_mint',
  TRADE_PLAYER: 'trade_player',
  MARKET_VISIT: 'market_visit',
  PASS_CLAIM: 'pass_claim',
  REFERRAL_SIGNUP: 'referral_signup',
} as const;
export type QuestTriggerType = (typeof QuestTrigger)[keyof typeof QuestTrigger];

export const QuestRewardType = {
  GMT: 'gmt',
  USDC: 'usdc',
  /** Moeda de ganhos/saques (a partir de 01/08/2026) — creditada no saldo usdtAmount. */
  USDT: 'usdt',
  OVERWALL: 'overwall',
  TEMP_PLAYER: 'temp_player',
  ITEM_TEMPLATE: 'item_template',
  SHOP_ITEM: 'shop_item',
  BADGE: 'badge',
} as const;
export type QuestRewardTypeName = (typeof QuestRewardType)[keyof typeof QuestRewardType];

/** Soft anti-fraud caps per claim (sum of all lines of that type). */
export const QUEST_REWARD_CAPS = {
  gmt: 10_000,
  usdc: 5_000,
  usdt: 5_000,
  overwall: 2_000,
  tempPlayerDays: 90,
  tempPlayerOverwall: 5_000,
} as const;

/** Temporary Overwall from quests lasts this many days and counts toward mining power. */
export const EVENT_OVERWALL_DURATION_DAYS = 7;

/** Absolute http(s) URL or relative `/uploads/...` path from image upload. */
export const eventMediaUrlSchema = z
  .string()
  .max(512)
  .refine(
    (v) => v.startsWith('/uploads/') || /^https?:\/\//i.test(v),
    { message: 'must be /uploads/... or http(s) URL' },
  );

export const questRewardSchema = z
  .object({
    type: z.enum([
      QuestRewardType.GMT,
      QuestRewardType.USDC,
      QuestRewardType.USDT,
      QuestRewardType.OVERWALL,
    ]),
    amount: z.number().positive().max(50_000).optional(),
    templateId: z.string().uuid().optional(),
    shopItemId: z.string().uuid().optional(),
    badgeId: z.string().uuid().optional(),
    playerName: z.string().min(1).max(64).optional(),
    overwall: z.number().int().min(1).max(QUEST_REWARD_CAPS.tempPlayerOverwall).optional(),
    days: z.number().int().min(1).max(QUEST_REWARD_CAPS.tempPlayerDays).optional(),
    position: z.number().int().min(0).max(10).optional(),
    imageUrl: eventMediaUrlSchema.optional().nullable(),
  })
  .superRefine((r, ctx) => {
    if (
      (r.type === QuestRewardType.GMT ||
        r.type === QuestRewardType.USDC ||
        r.type === QuestRewardType.USDT ||
        r.type === QuestRewardType.OVERWALL) &&
      (r.amount == null || r.amount <= 0)
    ) {
      ctx.addIssue({ code: 'custom', message: 'amount required', path: ['amount'] });
    }
  });

export type QuestReward = z.infer<typeof questRewardSchema>;

export const questKindSchema = z.enum([
  QuestKind.EVENT_TASK,
  QuestKind.DAILY_TASK,
  QuestKind.WEEKLY_TASK,
  QuestKind.ACHIEVEMENT,
]);

export const questPeriodSchema = z.enum([
  QuestPeriod.NONE,
  QuestPeriod.DAILY,
  QuestPeriod.WEEKLY,
]);

export const questTriggerSchema = z.enum([
  QuestTrigger.LOGIN,
  QuestTrigger.CHECKIN_CLAIM,
  QuestTrigger.LINEUP_SAVE,
  QuestTrigger.SCOUT_MINT,
  QuestTrigger.TRADE_PLAYER,
  QuestTrigger.MARKET_VISIT,
  QuestTrigger.PASS_CLAIM,
  QuestTrigger.REFERRAL_SIGNUP,
]);

function emptyToNull(value: unknown): unknown {
  if (value === '' || value === undefined) return null;
  return value;
}

export const eventCampaignUpsertSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  title: z.string().min(2).max(200),
  body: z.string().min(1).max(20_000),
  imageUrl: z.preprocess(emptyToNull, eventMediaUrlSchema.nullable()),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export const questDefinitionUpsertSchema = z.object({
  kind: questKindSchema,
  campaignId: z.string().uuid().optional().nullable(),
  title: z.string().min(2).max(200),
  description: z.string().min(1).max(5_000),
  trigger: questTriggerSchema,
  target: z.number().int().min(1).max(1_000_000),
  rewards: z.array(questRewardSchema).min(1).max(10),
  active: z.boolean().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  maxClaimsPerUser: z.number().int().min(1).max(1_000).optional(),
  maxGlobalClaims: z.number().int().min(1).max(10_000_000).optional().nullable(),
  requireEmailVerified: z.boolean().optional(),
  period: questPeriodSchema.optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export const eventBadgeUpsertSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/),
  title: z.string().min(2).max(120),
  iconUrl: z.preprocess(emptyToNull, eventMediaUrlSchema.nullable()),
});

export type EventCampaignUpsert = z.infer<typeof eventCampaignUpsertSchema>;
export type QuestDefinitionUpsert = z.infer<typeof questDefinitionUpsertSchema>;
export type EventBadgeUpsert = z.infer<typeof eventBadgeUpsertSchema>;
