import { QuestPeriod, type QuestPeriodType } from '@mll/shared';

/** Stable UTC period keys for daily/weekly quests. */
export function periodKeyFor(period: string | QuestPeriodType, now = new Date()): string {
  if (period === QuestPeriod.DAILY) {
    return now.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  if (period === QuestPeriod.WEEKLY) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    // ISO week: Thursday determines week year
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  return 'once';
}

export function isWithinWindow(
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;
  return true;
}
