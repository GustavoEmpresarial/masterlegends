/** Career age starts here at 0% ROI. */
export const PLAYER_CAREER_START_AGE = 18;
/** Career ends / museum retirement when ROI reaches 200%. */
export const PLAYER_CAREER_RETIRE_AGE = 40;
/** Years from start to retire (18 → 40). */
export const PLAYER_CAREER_AGE_SPAN = PLAYER_CAREER_RETIRE_AGE - PLAYER_CAREER_START_AGE;
/** Lifetime earned must reach this multiple of cost basis to retire. */
export const PLAYER_ROI_RETIRE_MULTIPLIER = 2;

export interface PlayerAgeRoi {
  /** Display age 18–40 (integer). */
  age: number;
  retireAge: number;
  /** ROI as percent of cost (100 = break-even, 200 = retire). */
  roiPct: number;
  /** True when earned >= 2× cost (or already retired). */
  isRetired: boolean;
  /** Whether this player has a paid career cycle. */
  hasCareerCycle: boolean;
}

/**
 * Map acquisition ROI to career age.
 * age = 18 + min(1, ROI/2) * 22  → 0%→18, 100%→29, 200%→40
 */
export function playerAgeFromRoi(
  costBasisUsdc: number,
  lifetimeEarnedUsdc: number,
  options?: { alreadyRetired?: boolean },
): PlayerAgeRoi {
  const cost = Number.isFinite(costBasisUsdc) ? Math.max(0, costBasisUsdc) : 0;
  const earned = Number.isFinite(lifetimeEarnedUsdc) ? Math.max(0, lifetimeEarnedUsdc) : 0;
  const hasCareerCycle = cost > 0;

  if (!hasCareerCycle) {
    return {
      age: PLAYER_CAREER_START_AGE,
      retireAge: PLAYER_CAREER_RETIRE_AGE,
      roiPct: 0,
      isRetired: options?.alreadyRetired === true,
      hasCareerCycle: false,
    };
  }

  const roiRatio = earned / cost;
  const roiPct = Math.round(roiRatio * 1000) / 10; // 1 decimal
  const progress = Math.min(1, roiRatio / PLAYER_ROI_RETIRE_MULTIPLIER);
  const age = Math.round(PLAYER_CAREER_START_AGE + progress * PLAYER_CAREER_AGE_SPAN);
  const isRetired =
    options?.alreadyRetired === true || earned + 1e-12 >= cost * PLAYER_ROI_RETIRE_MULTIPLIER;

  return {
    age: isRetired ? PLAYER_CAREER_RETIRE_AGE : Math.min(PLAYER_CAREER_RETIRE_AGE, age),
    retireAge: PLAYER_CAREER_RETIRE_AGE,
    roiPct,
    isRetired,
    hasCareerCycle: true,
  };
}
