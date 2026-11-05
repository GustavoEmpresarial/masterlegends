import * as THREE from 'three';

export const GOAL_W = 7.32;
export const GOAL_H = 2.44;
export const GOAL_Z = -11;
export const BALL_START: [number, number, number] = [0, 0.22, 0];
export const GOAL_LINE_Z = GOAL_Z + 0.2;

export type GamePhase = 'aiming' | 'charging' | 'flying' | 'result' | 'done';

export interface ShotTarget {
  x: number;
  y: number;
}

export interface FlightState {
  t: number;
  duration: number;
  start: THREE.Vector3;
  end: THREE.Vector3;
  peakY: number;
  resolved: boolean;
  power: number;
  serverScored?: boolean;
}

/** Power 0–1: higher = faster, flatter shot. */
export function createFlightState(
  target: ShotTarget,
  power = 0.65,
  serverScored?: boolean,
): FlightState {
  const p = Math.min(1, Math.max(0.25, power));
  return {
    t: 0,
    duration: THREE.MathUtils.lerp(1.15, 0.62, p),
    start: new THREE.Vector3(...BALL_START),
    end: new THREE.Vector3(target.x, target.y, GOAL_LINE_Z),
    peakY: Math.max(target.y + THREE.MathUtils.lerp(1.05, 0.35, p), 1.35),
    resolved: false,
    power: p,
    serverScored,
  };
}

export function aimNormToWorld(nx: number, ny: number): ShotTarget {
  const clampedX = Math.min(0.98, Math.max(0.02, nx));
  const clampedY = Math.min(0.98, Math.max(0.02, ny));
  return {
    x: (clampedX - 0.5) * (GOAL_W - 0.35),
    y: (1 - clampedY) * (GOAL_H - 0.35) + 0.18,
  };
}
