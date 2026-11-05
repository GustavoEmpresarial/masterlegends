import { z } from 'zod';

export const RECOVERY_MINIGAME_IDS = ['recovery_penalty'] as const;
export type RecoveryMinigameId = (typeof RECOVERY_MINIGAME_IDS)[number];

export const minigamePlayerRefSchema = z.object({
  kind: z.enum(['base', 'nft']),
  playerId: z.string().min(1),
});

/** Reward claim — requires a server-validated penalty session. */
export const minigamePlaySchema = minigamePlayerRefSchema
  .extend({
    sessionId: z.string().uuid(),
  })
  .strict();

export const penaltyStartSchema = minigamePlayerRefSchema.strict();

export const penaltyShootSchema = z
  .object({
    sessionId: z.string().uuid(),
    /** Normalized aim X (0–1) from click overlay. */
    nx: z.number().min(0).max(1),
    /** Normalized aim Y (0–1) from click overlay. */
    ny: z.number().min(0).max(1),
  })
  .strict();

export interface MinigameCatalogItemDTO {
  id: RecoveryMinigameId;
  nameKey: string;
  descriptionKey: string;
  staminaReward: number;
  /** Stamina spent on the chosen player when the session opens. */
  staminaCost: number;
  /** Seconds remaining before next play is allowed (0 = can play now). */
  cooldownSec: number;
  /** Total games played by this user for this minigame. */
  totalPlays: number;
}

export interface MinigamesCatalogDTO {
  games: MinigameCatalogItemDTO[];
}

export interface MinigamePlayResultDTO {
  minigameId: RecoveryMinigameId;
  playerId: string;
  kind: 'base' | 'nft';
  staminaBefore: number;
  staminaAfter: number;
}

export interface PenaltyStartResultDTO {
  sessionId: string;
  attempts: number;
}

export interface PenaltyShootResultDTO {
  scored: boolean;
  goals: number;
  attemptsLeft: number;
  finished: boolean;
  won: boolean;
}
