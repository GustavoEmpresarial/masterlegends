export const GOALS_TO_WIN = 3;

export type GoalSide = 'left' | 'center' | 'right';
export type ShotResult = 'goal' | 'save' | 'miss';

export function teamPower(overwalls: number[], fallbackEach = 40): number {
  if (overwalls.length === 0) return fallbackEach * 11;
  return overwalls.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

/**
 * A read of the keeper is a goal. The same side is a save.
 * A much stronger attack can still beat a correct dive; a much weaker one can be stopped on an open side.
 */
export function resolveShot(
  shot: GoalSide | null,
  keeper: GoalSide,
  attackPower: number,
  defensePower: number,
  roll: number,
): ShotResult {
  if (!shot) return 'miss';
  const ratio = attackPower / Math.max(1, defensePower);
  const open = shot !== keeper;
  if (open) {
    if (ratio < 0.55 && roll < 0.25) return 'save';
    return 'goal';
  }
  if (ratio > 1.35 && roll < 0.3) return 'goal';
  return 'save';
}

export function winnerOf(home: number, away: number): 'home' | 'away' | null {
  if (home >= GOALS_TO_WIN) return 'home';
  if (away >= GOALS_TO_WIN) return 'away';
  return null;
}
