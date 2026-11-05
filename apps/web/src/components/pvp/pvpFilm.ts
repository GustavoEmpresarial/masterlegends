import { resolveShot, type GoalSide, type ShotResult } from './pvpMatch';

export const ATTACK_SECONDS = 6.2;
export const BEAT_SECONDS = 1.45;
export const REPLAY_SECONDS = 3.8;

export const REPLAY_CAMERAS = ['cima', 'trave', 'escanteio'] as const;
export type ReplayCamera = (typeof REPLAY_CAMERAS)[number];

export function replayCameraForPlay(index: number): ReplayCamera {
  return REPLAY_CAMERAS[((index % REPLAY_CAMERAS.length) + REPLAY_CAMERAS.length) % REPLAY_CAMERAS.length] ?? 'cima';
}

export const REPLAY_LABEL: Record<ReplayCamera, string> = {
  cima: 'REPLAY · CIMA',
  trave: 'REPLAY · ATRÁS DO GOL',
  escanteio: 'REPLAY · ESCANTEIO',
};

export type FilmSide = 'home' | 'away';
export type FilmPose = 'idle' | 'run' | 'kick';

export interface FilmRosterPlayer {
  id: string;
  side: FilmSide;
  position: string;
  rarity: string;
  overwall: number;
  seed: string;
  slotRole: string;
  name: string;
  finishing?: number;
  goalkeeping?: number;
  age?: number | null;
  xPct: number;
  yPct: number;
  index: number;
}

export interface FilmBody {
  id: string;
  xPct: number;
  yPct: number;
  pose: FilmPose;
  facing: 1 | -1;
}

export interface AttackPlan {
  side: FilmSide;
  carrierId: string;
  result: ShotResult;
  shotY: number;
}

const SIDES: GoalSide[] = ['left', 'center', 'right'];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function ease(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function planAttack(
  side: FilmSide,
  roster: FilmRosterPlayer[],
  attackPower: number,
  defensePower: number,
  rand: () => number = Math.random,
): AttackPlan {
  const movers = roster.filter((p) => p.side === side && p.position !== 'GK');
  const pool = movers.length > 0 ? movers : roster.filter((p) => p.side === side);
  const carrier = pool[Math.floor(rand() * pool.length)] ?? roster[0];
  const shot = SIDES[Math.floor(rand() * SIDES.length)] ?? 'center';
  const keeper = SIDES[Math.floor(rand() * SIDES.length)] ?? 'center';
  const shotY = shot === 'left' ? 32 : shot === 'right' ? 68 : 50;
  return {
    side,
    carrierId: carrier?.id ?? 'home-fw',
    result: resolveShot(shot, keeper, attackPower, defensePower, rand()),
    shotY,
  };
}

function clampPct(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** Continuous build-up: players jog their zones and the ball is passed. */
export function sampleFlow(roster: FilmRosterPlayer[], time: number): {
  players: FilmBody[];
  ball: { xPct: number; yPct: number };
} {
  const passEvery = 3.1;
  const step = Math.floor(time / passEvery);
  const fly = ease((time / passEvery) - step);
  const runners = roster.filter((p) => p.position !== 'GK');
  const team: FilmSide = Math.floor(step / 3) % 2 === 0 ? 'home' : 'away';
  const sameSide = runners.filter((p) => p.side === team);
  const pool = sameSide.length > 0 ? sameSide : runners.length > 0 ? runners : roster;
  const from = pool[step % pool.length];
  const to = pool[(step + 1) % pool.length];

  const players = roster.map((p) => {
    const amp = p.position === 'GK' ? 0.35 : 1.8;
    const phase = time * 0.46 + p.index * 0.85;
    const xPct = clampPct(p.xPct + Math.sin(phase) * amp, 5, 95);
    const yPct = clampPct(p.yPct + Math.cos(phase * 0.8) * amp * 1.1, 8, 92);
    const movingRight = Math.cos(phase) >= 0;
    const facing: 1 | -1 = p.side === 'home' ? (movingRight ? 1 : -1) : movingRight ? -1 : 1;
    return {
      id: p.id,
      xPct,
      yPct,
      pose: (p.position === 'GK' ? 'idle' : 'run') as FilmPose,
      facing,
    };
  });

  const a = players.find((p) => p.id === from?.id) ?? players[0];
  const b = players.find((p) => p.id === to?.id) ?? players[0];
  return {
    players,
    ball: a && b
      ? { xPct: lerp(a.xPct, b.xPct, fly), yPct: lerp(a.yPct, b.yPct, fly) }
      : { xPct: 50, yPct: 50 },
  };
}

/** One attack, from the run-up to the shot. `u` goes from 0 to 1. */
export function sampleAttack(roster: FilmRosterPlayer[], plan: AttackPlan, u: number): {
  players: FilmBody[];
  ball: { xPct: number; yPct: number };
} {
  const players = roster.map((p) => {
    const attacking = p.side === plan.side;
    const facing: 1 | -1 = p.side === 'home' ? 1 : -1;
    const isCarrier = p.id === plan.carrierId;
    const boxX = plan.side === 'home' ? 72 : 28;
    if (attacking && isCarrier) {
      const runU = ease(Math.min(1, u / 0.46));
      return {
        id: p.id,
        xPct: lerp(p.xPct, boxX, runU),
        yPct: lerp(p.yPct, plan.shotY, runU * 0.45),
        pose: (u < 0.46 ? 'run' : u < 0.6 ? 'kick' : 'idle') as FilmPose,
        facing,
      };
    }
    if (attacking && p.position !== 'GK') {
      const runU = ease(Math.min(1, u / 0.5));
      const push = plan.side === 'home' ? 7 : -7;
      return {
        id: p.id,
        xPct: p.xPct + push * runU,
        yPct: p.yPct,
        pose: 'run' as FilmPose,
        facing,
      };
    }
    if (!attacking && p.position === 'GK' && u > 0.52) {
      const dive = ease(Math.min(1, (u - 0.52) / 0.28));
      return {
        id: p.id,
        xPct: p.xPct,
        yPct: lerp(p.yPct, plan.shotY, dive),
        pose: 'idle' as FilmPose,
        facing: (p.side === 'home' ? 1 : -1) as 1 | -1,
      };
    }
    return { id: p.id, xPct: p.xPct, yPct: p.yPct, pose: 'idle' as FilmPose, facing };
  });

  const carrier = players.find((p) => p.id === plan.carrierId) ?? players[0];
  const goalX = plan.side === 'home' ? 102 : -2;
  const postX = plan.side === 'home' ? 99.5 : 0.5;
  const saveX = plan.side === 'home' ? 90 : 10;
  const woodwork = plan.result !== 'goal' && plan.shotY !== 50;
  const destX = plan.result === 'goal' ? goalX : woodwork ? postX : saveX;
  const destY = plan.result === 'goal' ? 50 : plan.shotY;
  let xPct = 50;
  let yPct = 50;
  if (carrier && u < 0.62) {
    xPct = carrier.xPct;
    yPct = carrier.yPct;
  } else if (carrier) {
    const fly = ease(Math.min(1, (u - 0.62) / 0.38));
    xPct = lerp(carrier.xPct, destX, fly);
    yPct = lerp(carrier.yPct, destY, fly);
  }
  return { players, ball: { xPct, yPct } };
}
