export interface FieldPoint {
  xPct: number;
  yPct: number;
}

export interface BallPathSlot {
  xPct: number;
  yPct: number;
  role?: string;
  /** Slot id when this point is a player visit (for kick sync). */
  slotId?: string;
}

export interface BallPathPoint extends FieldPoint {
  /** Player slot being visited; null for midfield / shot / recycle points. */
  visitSlotId: string | null;
}

/** Rota da bola passando pelos jogadores (defesa → meio → ataque). */
export function buildStadiumBallPath(slots: BallPathSlot[]): BallPathPoint[] {
  const active = slots.filter((s) => s.role !== 'DECOR');
  if (active.length === 0) return [];

  const sorted = [...active].sort((a, b) => b.yPct - a.yPct);
  const path: BallPathPoint[] = sorted.map((s) => ({
    xPct: s.xPct,
    yPct: s.yPct,
    visitSlotId: s.slotId ?? null,
  }));

  const midIdx = Math.floor(sorted.length / 2);
  path.splice(midIdx, 0, { xPct: 50, yPct: 54, visitSlotId: null });

  const fw = sorted.reduce((best, s) => (s.yPct < best.yPct ? s : best), sorted[0]!);
  // Shot toward goal — no player visit (don't kick the air)
  path.push({
    xPct: Math.min(88, Math.max(12, fw.xPct + (fw.xPct >= 50 ? -6 : 6))),
    yPct: Math.max(16, fw.yPct - 14),
    visitSlotId: null,
  });

  path.push({ xPct: 50, yPct: 70, visitSlotId: null });
  return path;
}

export function ballPathDuration(pointCount: number): number {
  return Math.max(8, pointCount * 1.35);
}

/**
 * Approximate which path index the ball is nearest to given elapsed time in a
 * repeating easeInOut loop (good enough for kick pose sync).
 */
export function ballPathIndexAt(elapsedSec: number, pointCount: number, durationSec: number): number {
  if (pointCount < 2 || durationSec <= 0) return 0;
  const t = ((elapsedSec % durationSec) + durationSec) % durationSec;
  const u = t / durationSec;
  // Match framer easeInOut-ish: denser near ends — use smoothstep remap then linear index
  const smooth = u * u * (3 - 2 * u);
  return Math.min(pointCount - 1, Math.max(0, Math.round(smooth * (pointCount - 1))));
}
