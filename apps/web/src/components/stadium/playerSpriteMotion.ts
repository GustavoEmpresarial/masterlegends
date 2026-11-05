export interface SpriteMotion {
  /** Per-actor clock, advanced by actual travel speed. */
  gaitMs?: number;
  reducedMotion?: boolean;
}

/** Frame 0: rest; 1–6: locomotion; 7: strike. */
export function playerSpriteFrame(pose: 'idle' | 'run' | 'kick', timeMs: number, reducedMotion = false): number {
  if (reducedMotion || pose === 'idle') return 0;
  if (pose === 'kick') return 7;
  const tick = Math.floor(Math.max(0, Number.isFinite(timeMs) ? timeMs : 0) * 0.012);
  return 1 + tick % 6;
}

export function advanceSpriteGait(clock: number, distance: number, dt: number, scale: number): number {
  if (dt <= 0 || distance <= 0) return clock;
  const speed = distance / dt / Math.max(1, scale);
  return clock + dt * 1000 * Math.max(0.4, Math.min(1.4, speed / 35));
}
