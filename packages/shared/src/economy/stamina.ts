import { fieldRole } from './attributes.js';
import { STAMINA_MAX, type LineupAssignment } from '../schemas/stadium.js';

/** Coach only auto-fields players at full stamina. */
export const MIN_STAMINA_AUTO_FIELD = 100;

export function coachStaminaPer5Min(recoveryPerHour: number): number {
  return recoveryPerHour / 12;
}

/**
 * Atualiza stamina pelo tempo decorrido desde staminaUpdatedAt.
 * - Em campo: drain por raridade (fieldDrainPerHour), sem recovery.
 * - No banco com treinador: recovery configurável, sem decay.
 * - No banco sem treinador: inalterado.
 */
export function applyStaminaDrift(
  current: number,
  staminaUpdatedAt: Date,
  now: Date,
  coachHired: boolean,
  recoveryPerHour = 24,
  onField = false,
  fieldDrainPerHour?: number,
): number {
  const minutes = (now.getTime() - staminaUpdatedAt.getTime()) / 60000;
  if (minutes <= 0) return current;

  let delta = 0;

  if (onField) {
    const drainPerHour = fieldDrainPerHour ?? 0;
    delta -= (minutes / 60) * drainPerHour;
  } else if (coachHired) {
    const per5Min = coachStaminaPer5Min(recoveryPerHour);
    delta += (minutes * per5Min) / 5;
  }

  const next = current + delta;
  return Math.max(0, Math.min(STAMINA_MAX, Math.round(next)));
}

export interface RecoveredStarter {
  playerId: string;
  kind: 'base' | 'nft';
  overwall: number;
  position: number | string;
}

/**
 * Puts full-stamina players into empty lineup slots of the same position.
 * Does not replace anyone already on the pitch.
 */
export function fillRecoveredLineup(
  slots: Array<{ id: string; role?: string | null }>,
  assignments: Record<string, LineupAssignment>,
  candidates: RecoveredStarter[],
): { assignments: Record<string, LineupAssignment>; changed: boolean } {
  const next: Record<string, LineupAssignment> = { ...assignments };
  const used = new Set(Object.values(next).map((a) => `${a.kind}:${a.playerId}`));
  const ranked = [...candidates].sort((a, b) => b.overwall - a.overwall);
  let changed = false;

  for (const slot of slots) {
    if (!slot.id || !slot.role || slot.role === 'DECOR' || next[slot.id]) continue;
    const index = ranked.findIndex(
      (c) => !used.has(`${c.kind}:${c.playerId}`) && fieldRole(c.position) === fieldRole(slot.role),
    );
    if (index < 0) continue;
    const pick = ranked[index]!;
    next[slot.id] = { playerId: pick.playerId, kind: pick.kind };
    used.add(`${pick.kind}:${pick.playerId}`);
    changed = true;
  }

  return { assignments: next, changed };
}
