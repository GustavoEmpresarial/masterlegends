import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type {
  MinigameCatalogItemDTO,
  MinigamePlayResultDTO,
  MinigamesCatalogDTO,
  PenaltyShootResultDTO,
  PenaltyStartResultDTO,
  RecoveryMinigameId,
} from '@mll/shared';
import {
  PENALTY_ATTEMPTS,
  RECOVERY_MINIGAME_IDS,
  mapPenaltyAim,
  minigamePlaySchema,
  penaltyShootSchema,
  penaltyStartSchema,
  resolvePenaltyShot,
  rollPenaltyGoalieEnd,
} from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { secureRandom } from '../../common/lib/secure-random.js';
import { ClubRepository } from '../club/club.repository.js';
import { StaminaService } from '../stamina/stamina.service.js';
import { applyTrainingEvolution } from '../ct/ct-record.js';
import { getStaminaRules } from '../stamina/stamina-rules.js';

const PENALTY_SESSION_TTL_SEC = 900;
const PENALTY_SESSION_PREFIX = 'mll:minigame:penalty:';
const COOLDOWN_PREFIX = 'mll:mg:cooldown:';

/**
 * Cooldown system:
 * - Every 10 games played adds 10 seconds of cooldown.
 * - After 12 hours since the last cooldown increment, it starts decaying.
 * - Each additional 12-hour period removes 10 seconds (one level).
 */
interface CooldownState {
  gamesPlayed: number;
  /** Number of 10-second levels stacked when last incremented. */
  cooldownLevel: number;
  /** Timestamp (ms) when cooldownLevel was last raised. */
  levelSetAt: number;
}

const GAMES_PER_LEVEL = 10;
const SECS_PER_LEVEL = 10;
const DECAY_START_MS = 12 * 60 * 60 * 1000; // 12h before decay starts
const DECAY_PERIOD_MS = 12 * 60 * 60 * 1000; // one level removed per 12h after that

interface PenaltySession {
  userId: string;
  playerId: string;
  kind: 'base' | 'nft';
  attemptsLeft: number;
  goals: number;
  finished: boolean;
  claimed: boolean;
}

const CATALOG: Array<{
  id: RecoveryMinigameId;
  nameKey: string;
  descriptionKey: string;
}> = [
  {
    id: 'recovery_penalty',
    nameKey: 'minigames:games.recovery_penalty.name',
    descriptionKey: 'minigames:games.recovery_penalty.description',
  },
];

export class MinigamesService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clubRepo: ClubRepository,
    private readonly staminaService: StaminaService,
    private readonly redis: Redis,
  ) {}

  // ── Penalty session helpers ────────────────────────────────────────────────

  private sessionKey(sessionId: string) {
    return `${PENALTY_SESSION_PREFIX}${sessionId}`;
  }

  private async loadSession(userId: string, sessionId: string): Promise<PenaltySession> {
    const raw = await this.redis.get(this.sessionKey(sessionId));
    if (!raw) throw new AppError(ErrorCode.MINIGAME_NOT_FOUND, 404, { reason: 'session_expired' });
    const session = JSON.parse(raw) as PenaltySession;
    if (session.userId !== userId) throw new AppError(ErrorCode.MINIGAME_NOT_FOUND, 404);
    return session;
  }

  private async saveSession(sessionId: string, session: PenaltySession) {
    await this.redis.set(this.sessionKey(sessionId), JSON.stringify(session), 'EX', PENALTY_SESSION_TTL_SEC);
  }

  private isValidMinigameId(id: string): id is RecoveryMinigameId {
    return (RECOVERY_MINIGAME_IDS as readonly string[]).includes(id);
  }

  // ── Cooldown helpers ───────────────────────────────────────────────────────

  private cooldownKey(userId: string, minigameId: string) {
    return `${COOLDOWN_PREFIX}${minigameId}:${userId}`;
  }

  private async loadCooldownState(userId: string, minigameId: string): Promise<CooldownState> {
    const raw = await this.redis.get(this.cooldownKey(userId, minigameId));
    if (!raw) return { gamesPlayed: 0, cooldownLevel: 0, levelSetAt: 0 };
    return JSON.parse(raw) as CooldownState;
  }

  private async saveCooldownState(userId: string, minigameId: string, state: CooldownState) {
    // Keep for 7 days — long enough for any reasonable cooldown to fully decay
    await this.redis.set(this.cooldownKey(userId, minigameId), JSON.stringify(state), 'EX', 7 * 24 * 3600);
  }

  /**
   * Returns the effective cooldown in seconds based on stored state and current time.
   * After 12 hours from levelSetAt each additional 12-hour period removes one level (10 seconds).
   */
  private effectiveCooldownSec(state: CooldownState, now = Date.now()): number {
    if (state.cooldownLevel === 0) return 0;
    const elapsed = now - state.levelSetAt;
    if (elapsed < DECAY_START_MS) return state.cooldownLevel * SECS_PER_LEVEL;
    const decayedLevels = Math.floor((elapsed - DECAY_START_MS) / DECAY_PERIOD_MS);
    return Math.max(0, (state.cooldownLevel - decayedLevels) * SECS_PER_LEVEL);
  }

  /**
   * After a game is played: bump gamesPlayed, and if a new level threshold is crossed
   * add one cooldown level (resetting the decay timer).
   */
  private async recordGamePlayed(userId: string, minigameId: string): Promise<void> {
    const now = Date.now();
    const state = await this.loadCooldownState(userId, minigameId);
    state.gamesPlayed += 1;

    if (state.gamesPlayed % GAMES_PER_LEVEL === 0) {
      const currentEffectiveLevel = Math.max(
        0,
        state.cooldownLevel - (state.levelSetAt
          ? Math.floor(Math.max(0, now - state.levelSetAt - DECAY_START_MS) / DECAY_PERIOD_MS)
          : 0),
      );
      state.cooldownLevel = currentEffectiveLevel + 1;
      state.levelSetAt = now;
    }

    await this.saveCooldownState(userId, minigameId, state);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async getCatalog(userId: string): Promise<MinigamesCatalogDTO> {
    const now = Date.now();
    const rules = await getStaminaRules(this.prisma);
    const games: MinigameCatalogItemDTO[] = await Promise.all(
      CATALOG.map(async (g) => {
        const state = await this.loadCooldownState(userId, g.id);
        const cooldownSec = this.effectiveCooldownSec(state, now);
        return {
          id: g.id,
          nameKey: g.nameKey,
          descriptionKey: g.descriptionKey,
          staminaReward: 0,
          staminaCost: rules.trainingStaminaCost,
          cooldownSec,
          totalPlays: state.gamesPlayed,
        };
      }),
    );
    return { games };
  }

  async startPenalty(userId: string, raw: unknown): Promise<PenaltyStartResultDTO> {
    const body = penaltyStartSchema.parse(raw);
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const state = await this.loadCooldownState(userId, 'recovery_penalty');
    const cooldownSec = this.effectiveCooldownSec(state);
    if (cooldownSec > 0) {
      throw new AppError(ErrorCode.MINIGAME_ALREADY_PLAYED, 400, {
        reason: 'cooldown',
        cooldownSec,
      });
    }

    const rules = await getStaminaRules(this.prisma);
    if (rules.trainingStaminaCost > 0) {
      await this.staminaService.applyDelta(
        userId,
        { kind: body.kind, playerId: body.playerId },
        -rules.trainingStaminaCost,
        { rejectIfShort: true, reason: 'training' },
      );
    }
    await this.recordGamePlayed(userId, 'recovery_penalty');

    const sessionId = randomUUID();
    const session: PenaltySession = {
      userId,
      playerId: body.playerId,
      kind: body.kind,
      attemptsLeft: PENALTY_ATTEMPTS,
      goals: 0,
      finished: false,
      claimed: false,
    };
    await this.saveSession(sessionId, session);
    return { sessionId, attempts: PENALTY_ATTEMPTS };
  }

  async shootPenalty(userId: string, raw: unknown): Promise<PenaltyShootResultDTO> {
    const body = penaltyShootSchema.parse(raw);
    const session = await this.loadSession(userId, body.sessionId);

    if (session.finished) {
      throw new AppError(ErrorCode.MINIGAME_ALREADY_PLAYED, 400, { reason: 'session_finished' });
    }
    if (session.attemptsLeft <= 0) {
      throw new AppError(ErrorCode.MINIGAME_ALREADY_PLAYED, 400);
    }

    const { x, y } = mapPenaltyAim(body.nx, body.ny);
    const goalieEnd = rollPenaltyGoalieEnd(secureRandom);
    const scored = resolvePenaltyShot(x, y, goalieEnd);

    session.attemptsLeft -= 1;
    if (scored) session.goals += 1;
    session.finished = session.attemptsLeft <= 0;

    await this.saveSession(body.sessionId, session);

    return {
      scored,
      goals: session.goals,
      attemptsLeft: session.attemptsLeft,
      finished: session.finished,
      won: session.finished && session.goals > 0,
    };
  }

  async play(userId: string, minigameId: string, raw: unknown): Promise<MinigamePlayResultDTO> {
    if (!this.isValidMinigameId(minigameId)) {
      throw new AppError(ErrorCode.MINIGAME_NOT_FOUND, 404);
    }

    const body = minigamePlaySchema.parse(raw);
    const session = await this.loadSession(userId, body.sessionId);

    if (session.playerId !== body.playerId || session.kind !== body.kind) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'player_mismatch' });
    }
    if (!session.finished) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'session_not_finished' });
    }
    if (session.goals <= 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'no_goals' });
    }
    if (session.claimed) {
      throw new AppError(ErrorCode.MINIGAME_ALREADY_PLAYED, 400);
    }

    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    await this.prisma.minigamePlay.create({
      data: { userId, minigameId },
    });

    const rules = await getStaminaRules(this.prisma);
    await applyTrainingEvolution(
      this.prisma,
      userId,
      { kind: body.kind, playerId: body.playerId },
      club.ctLvl ?? 1,
      rules.trainingStaminaCost,
    );

    session.claimed = true;
    await this.redis.del(this.sessionKey(body.sessionId));

    const stamina = await this.staminaService.readStamina(userId, {
      kind: body.kind,
      playerId: body.playerId,
    });

    return {
      minigameId,
      playerId: body.playerId,
      kind: body.kind,
      staminaBefore: stamina,
      staminaAfter: stamina,
    };
  }
}
