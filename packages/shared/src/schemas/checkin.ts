import { z } from 'zod';

export const checkInGrantItemSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().int().positive(),
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  daysLeft: z.number().int().min(0),
});

export type CheckInGrantItemDTO = z.infer<typeof checkInGrantItemSchema>;

export const checkInStreakRewardPreviewSchema = z.object({
  name: z.string(),
  imageUrl: z.string().nullable(),
  overwall: z.number().int().min(0),
  position: z.number().int().min(0).max(4),
  durationDays: z.number().int().positive(),
});

export type CheckInStreakRewardPreviewDTO = z.infer<typeof checkInStreakRewardPreviewSchema>;

export const checkInStatusSchema = z.object({
  activeOverwall: z.number().int().min(0),
  maxActiveOverwall: z.number().int().positive(),
  lineupOverwall: z.number().int().min(0),
  totalOverwall: z.number().int().min(0),
  canClaimToday: z.boolean(),
  nextAvailableAt: z.string().datetime().nullable(),
  lastCheckInDay: z.string().datetime().nullable(),
  grants: z.array(checkInGrantItemSchema),
  streak: z.number().int().min(0),
  streakTarget: z.number().int().positive(),
  nextStreakRewardIn: z.number().int().min(0),
  streakReward: checkInStreakRewardPreviewSchema,
});

export type CheckInStatusDTO = z.infer<typeof checkInStatusSchema>;

export const checkInClaimResultSchema = z.object({
  grant: checkInGrantItemSchema,
  activeOverwall: z.number().int().min(0),
  lineupOverwall: z.number().int().min(0),
  totalOverwall: z.number().int().min(0),
  streak: z.number().int().min(0),
  streakTarget: z.number().int().positive(),
  nextStreakRewardIn: z.number().int().min(0),
  streakRewardGranted: z.boolean(),
  streakRewardPlayerName: z.string().nullable().optional(),
  streakReward: checkInStreakRewardPreviewSchema.optional(),
});

export type CheckInClaimResultDTO = z.infer<typeof checkInClaimResultSchema>;
