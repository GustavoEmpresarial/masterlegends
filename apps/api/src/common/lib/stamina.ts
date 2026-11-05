import { STAMINA_MAX, applyStaminaDrift, coachStaminaPer5Min } from '@mll/shared';

export { STAMINA_MAX, applyStaminaDrift, coachStaminaPer5Min };

export function effectiveOverwall(overwall: number, stamina: number): number {
  return Math.floor((overwall * Math.min(STAMINA_MAX, Math.max(0, stamina))) / STAMINA_MAX);
}

export function passiveRecoveryPerHour(
  ctLvl: number,
  coachHired = false,
  recoveryPerHour = 24,
): number {
  if (!coachHired) return 0;
  const level = Number.isFinite(ctLvl) ? Math.max(0, Math.floor(ctLvl)) : 0;
  return recoveryPerHour + level;
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function canClaimDailyRest(lastDailyRestAt: Date | null | undefined, now = new Date()): boolean {
  if (!lastDailyRestAt) return true;
  return !isSameUtcDay(lastDailyRestAt, now);
}

export function nextRestAvailableAt(lastDailyRestAt: Date | null | undefined, now = new Date()): Date | null {
  if (canClaimDailyRest(lastDailyRestAt, now)) return null;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}
