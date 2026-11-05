/** How long an unstaked player stays on the pitch. */
export const FREE_FIELD_PLAY_MS = 5 * 60 * 1000;

/** Wait after the window starts before the same player can enter again. */
export const FREE_FIELD_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type FreeFieldState = 'unlimited' | 'ready' | 'playing' | 'locked';

export interface FreeFieldWindowDTO {
  state: FreeFieldState;
  playEndsAt: string | null;
  nextPlayAt: string | null;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Unstaked players get one 5-minute pitch window every 24 hours.
 * The clock starts when they enter. Staked players are unlimited.
 */
export function freeFieldStatus(input: {
  staked: boolean;
  windowStartedAt?: string | Date | number | null;
  now?: number;
}): FreeFieldWindowDTO {
  if (input.staked) {
    return { state: 'unlimited', playEndsAt: null, nextPlayAt: null };
  }

  const raw = input.windowStartedAt;
  const started =
    raw == null
      ? NaN
      : typeof raw === 'number'
        ? raw
        : new Date(raw).getTime();
  if (!Number.isFinite(started)) {
    return { state: 'ready', playEndsAt: null, nextPlayAt: null };
  }

  const now = input.now ?? Date.now();
  const playEnds = started + FREE_FIELD_PLAY_MS;
  const nextPlay = started + FREE_FIELD_COOLDOWN_MS;
  if (now < playEnds) {
    return { state: 'playing', playEndsAt: iso(playEnds), nextPlayAt: iso(nextPlay) };
  }
  if (now < nextPlay) {
    return { state: 'locked', playEndsAt: iso(playEnds), nextPlayAt: iso(nextPlay) };
  }
  return { state: 'ready', playEndsAt: null, nextPlayAt: null };
}

/** Keep a saved lineup spot only while stake is active or the 5-minute window is open. */
export function staysOnFreeField(
  staked: boolean,
  windowStartedAt?: string | Date | number | null,
  now = Date.now(),
): boolean {
  const state = freeFieldStatus({ staked, windowStartedAt, now }).state;
  return state === 'unlimited' || state === 'playing';
}
