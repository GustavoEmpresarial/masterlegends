export const PENALTY_GOAL_W = 7.32;
export const PENALTY_GOAL_H = 2.44;
export const PENALTY_ATTEMPTS = 3;

/** Map normalized click (0–1) to goal coordinates. */
export function mapPenaltyAim(nx: number, ny: number): { x: number; y: number } {
  return {
    x: (nx - 0.5) * (PENALTY_GOAL_W - 0.3),
    y: (1 - ny) * (PENALTY_GOAL_H - 0.3) + 0.2,
  };
}

export function rollPenaltyGoalieEnd(rand: () => number): number {
  const guess = rand();
  if (guess < 0.34) return -PENALTY_GOAL_W / 4;
  if (guess < 0.67) return 0;
  return PENALTY_GOAL_W / 4;
}

export function resolvePenaltyShot(targetX: number, targetY: number, goalieEnd: number): boolean {
  const isInGoal =
    targetX > -PENALTY_GOAL_W / 2 + 0.18 &&
    targetX < PENALTY_GOAL_W / 2 - 0.18 &&
    targetY < PENALTY_GOAL_H - 0.15;
  const goalieAtBall = Math.abs(targetX - goalieEnd);
  const blocked = isInGoal && goalieAtBall < 1.1 && targetY < 1.6;
  return isInGoal && !blocked;
}
