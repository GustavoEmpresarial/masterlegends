export const CHECKIN_OVERWALL_AMOUNT = 1;
export const CHECKIN_OVERWALL_TTL_DAYS = 7;
export const CHECKIN_MAX_ACTIVE_OVERWALL =
  CHECKIN_OVERWALL_AMOUNT * CHECKIN_OVERWALL_TTL_DAYS;
export const CHECKIN_STREAK_THRESHOLD_DEFAULT = 7;

/**
 * O "dia" do check-in é o dia calendário em UTC puro (00:00 UTC).
 * Offset fixo em 0: o corte do dia é sempre meia-noite UTC, sem ajuste
 * de fuso horário local.
 */
const CHECKIN_TZ_OFFSET_MINUTES = 0; // UTC (sem offset)

function toCheckinLocal(date: Date): Date {
  return new Date(date.getTime() + CHECKIN_TZ_OFFSET_MINUTES * 60_000);
}

/** Início (meia-noite local) do dia de check-in que contém `now`, como sentinela UTC. */
export function utcDayStart(now = new Date()): Date {
  const local = toCheckinLocal(now);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

export function utcDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Count consecutive check-in days (calendar days in America/Sao_Paulo).
 * - Starts at today if already claimed; otherwise at yesterday (streak still "alive" until day ends).
 * - Missing one full local day breaks the chain (streak resets to 0 until the next claim).
 */
export function countConsecutiveCheckInStreak(checkInDays: Date[], now = new Date()): number {
  const keys = new Set(checkInDays.map(utcDayKey));
  let streak = 0;
  let cursor = utcDayStart(now);
  if (!keys.has(utcDayKey(cursor))) {
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() - 1));
  }
  while (keys.has(utcDayKey(cursor))) {
    streak += 1;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() - 1));
  }
  return streak;
}

export function checkInExpiresAt(from = new Date()): Date {
  const expires = new Date(from);
  expires.setUTCDate(expires.getUTCDate() + CHECKIN_OVERWALL_TTL_DAYS);
  return expires;
}

/** Instante real (UTC) da próxima meia-noite em America/Sao_Paulo após `now`. */
export function nextCheckInAvailableAt(now = new Date()): Date {
  const local = toCheckinLocal(now);
  const nextLocalMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + 1,
  );
  return new Date(nextLocalMidnight - CHECKIN_TZ_OFFSET_MINUTES * 60_000);
}
