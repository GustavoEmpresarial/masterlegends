import { useEffect, useMemo, useRef } from 'react';
import type { LineupPlayerDTO, StadiumSlot } from '@mll/shared';
import { advanceSpriteGait } from './playerSpriteMotion';
import { playerNickname } from '../../lib/playerNickname';
import {
  drawPlayfieldBall,
  drawPlayfieldPlayer,
  type PlayfieldActor,
} from './stadiumPlayfieldDraw';

interface SlotView {
  slot: StadiumSlot;
  player: LineupPlayerDTO | null;
}

interface StadiumPlayfieldLayerProps {
  slots: SlotView[];
  livePlay?: boolean;
  /** Mini app do campo: só o boneco, sem a plaquinha de nome/OW. */
  nameplates?: boolean;
  /** Barra de estamina embaixo do boneco. Substitui a plaquinha. */
  staminaBars?: boolean;
  /** Locker room: walk back and forth on the floor. No ball. */
  plantOnFloor?: boolean;
  /** Slot x/y are already screen positions. */
  useGivenPositions?: boolean;
}

/** Pitch percentages → torso anchor whose boots sit on the vestiário floor. */
export function projectLockerFloor(xPct: number, yPct: number): { xPct: number; yPct: number } {
  const t = Math.min(1, Math.max(0, yPct / 100));
  const footY = 62 + t * 26;
  const y = footY - 5.5;
  const half = 18 + t * 16;
  const x = 50 + ((Math.min(100, Math.max(0, xPct)) - 50) / 50) * half;
  return {
    xPct: Math.min(94, Math.max(6, x)),
    yPct: Math.min(92, Math.max(50, y)),
  };
}

type Pose = 'idle' | 'run' | 'kick';

interface SimPlayer {
  actor: PlayfieldActor;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  pose: Pose;
  kickUntil: number;
  gaitMs?: number;
  drawX?: number;
  drawY?: number;
}

interface SimBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Index into players[], or null if loose. */
  holder: number | null;
  /** Who the open pass is meant for — chases hard. */
  intended: number | null;
  /** Passer cannot reclaim until this sim-time (anti re-grab). */
  noPickupIdx: number | null;
  noPickupUntil: number;
  passCooldown: number;
  z: number;
  vz: number;
  /** Seconds loose while nearly stopped — anti-stuck. */
  looseStill: number;
}

const SPEED = 130;
const ACCEL = 560;
const FRICTION = 6.2;
const CHASE_RADIUS = 160;
const PICKUP_RADIUS = 20;
const PASS_MIN = 0.4;
const PASS_MAX = 0.95;
const KICK_HOLD = 0.22;
const HOME_PULL = 48;
const SEP_R = 30;
const SEP_FORCE = 180;
const MAX_HOME_DRIFT = 240;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function staminaRatio(current: number | null | undefined, max: number | null | undefined): number {
  const cap = max != null && max > 0 ? max : 100;
  const value = current != null && Number.isFinite(current) ? current : cap;
  return clamp((value / cap) * 100, 0, 100);
}

function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

/** Horizontal patrol on the locker-room floor. Same clock for the sprite and its click target. */
export function lockerPace(
  seed: string,
  index: number,
  timeSec: number,
  homePct = 50,
): { xPct: number; facing: 1 | -1; moving: boolean } {
  const period = 10.5 + hash01(`${seed}:pace`) * 4;
  const phase = hash01(`${seed}:ph`) * Math.PI * 2 + index * 0.4;
  const span = 2 + hash01(`${seed}:span`) * 1.5;
  const arg = (timeSec / period) * Math.PI * 2 + phase;
  const xPct = Math.max(6, Math.min(94, homePct + Math.sin(arg) * span));
  const dir = Math.cos(arg);
  return {
    xPct,
    facing: dir >= 0 ? 1 : -1,
    moving: Math.abs(dir) > 0.2,
  };
}

/**
 * Canvas playfield — simulação leve: posse, passe e corrida (não só idle no meio).
 */
export function StadiumPlayfieldLayer({ slots, livePlay = true, plantOnFloor = false, useGivenPositions = false, nameplates = true, staminaBars = false }: StadiumPlayfieldLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const livePlayRef = useRef(livePlay);
  livePlayRef.current = livePlay;
  const plantRef = useRef(plantOnFloor);
  plantRef.current = plantOnFloor;
  const nameplatesRef = useRef(nameplates);
  nameplatesRef.current = nameplates;
  const staminaBarsRef = useRef(staminaBars);
  staminaBarsRef.current = staminaBars;

  const actors = useMemo<PlayfieldActor[]>(() => {
    const out: PlayfieldActor[] = [];
    slots.forEach(({ slot, player }, index) => {
      if (!player || slot.role === 'DECOR') return;
      const side = slot.side === 'away' || String(slot.id).startsWith('rival-') ? 'away' : 'home';
      const rawX = slot.xPct;
      const planted = !useGivenPositions && plantOnFloor ? projectLockerFloor(rawX, slot.yPct) : null;
      out.push({
        slotId: slot.id,
        xPct: useGivenPositions ? slot.xPct : (planted?.xPct ?? rawX),
        yPct: useGivenPositions ? slot.yPct : (planted?.yPct ?? slot.yPct),
        rarity: player.rarity ?? 'common',
        position: player.position ?? 'MID',
        slotRole: slot.role,
        name: playerNickname(player.name, player.id, player.position ?? 'Jogador').slice(0, 24),
        imageUrl: side === 'home' ? player.imageUrl ?? null : null,
        overwall: Number.isFinite(player.overwall) ? player.overwall : 0,
        finishing: (player.attributes?.finalizacao ?? Math.max(1, player.overwall)) / Math.max(1, player.overwall),
        goalkeeping: (player.attributes?.goleiro ?? Math.max(1, player.overwall)) / Math.max(1, player.overwall),
        age: player.age != null && Number.isFinite(player.age) ? player.age : null,
        staminaPct: staminaRatio(player.stamina, player.staminaMax),
        seed: player.id || `s${index}`,
        index,
        side,
      });
    });

    return out;
  }, [slots, plantOnFloor, useGivenPositions]);

  const actorsKey = useMemo(
    () => actors.map((a) => `${a.slotId}:${a.seed}:${a.xPct}:${a.yPct}`).join('|'),
    [actors],
  );

  const actorsRef = useRef(actors);
  actorsRef.current = actors;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    let raf = 0;
    let running = true;
    let last = performance.now();
    let elapsed = 0;
    let players: SimPlayer[] = [];
    let ball: SimBall = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      holder: null,
      intended: null,
      noPickupIdx: null,
      noPickupUntil: 0,
      passCooldown: 0.8,
      z: 0,
      vz: 0,
      looseStill: 0,
    };
    let w = 0;
    let h = 0;
    let inited = false;
    let lastActorsKey = '';
    /** Last few holders — avoid ping-pong between the same 3. */
    let recentHolders: number[] = [];
    let passCount = 0;
    let lastPasser: number | null = null;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = motionQuery.matches;
    const onMotion = () => {
      reduceMotion = motionQuery.matches;
    };
    motionQuery.addEventListener('change', onMotion);

    const playScale = () => (w >= 520 ? 3 : 2);

    /** Actor origin = torso; boots sit ~12–14 local units below. */
    const footOf = (p: SimPlayer) => {
      const s = playScale();
      return {
        x: p.x + p.facing * s * 2.4,
        y: p.y + s * 12.5,
      };
    };

    const roleKey = (p: SimPlayer): 'GK' | 'DEF' | 'MID' | 'FW' => {
      const raw = String(p.actor.slotRole || p.actor.position || 'MID').toUpperCase();
      if (raw === 'GK' || raw === 'GOL') return 'GK';
      if (raw === 'DEF' || raw === 'ZAG' || raw === 'LAT') return 'DEF';
      if (raw === 'FW' || raw === 'ATA') return 'FW';
      return 'MID';
    };

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nw = Math.max(1, Math.floor(rect.width));
      const nh = Math.max(1, Math.floor(rect.height));
      const changed = nw !== w || nh !== h;
      w = nw;
      h = nh;
      if (canvas.width !== Math.floor(nw * dpr) || canvas.height !== Math.floor(nh * dpr)) {
        canvas.width = Math.floor(nw * dpr);
        canvas.height = Math.floor(nh * dpr);
        canvas.style.width = `${nw}px`;
        canvas.style.height = `${nh}px`;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
      }
      return changed;
    };

    /** Update homes/positions for new canvas size — keep ball possession. */
    const syncLayout = () => {
      if (w < 2 || h < 2 || players.length === 0) return;
      const list = actorsRef.current;
      const prevPlayers = players;
      const prevHolderSeed =
        ball.holder != null && prevPlayers[ball.holder] ? prevPlayers[ball.holder]!.actor.seed : null;
      const prevIntendedSeed =
        ball.intended != null && prevPlayers[ball.intended]
          ? prevPlayers[ball.intended]!.actor.seed
          : null;
      const prevNoPickupSeed =
        ball.noPickupIdx != null && prevPlayers[ball.noPickupIdx]
          ? prevPlayers[ball.noPickupIdx]!.actor.seed
          : null;

      players = list.map((actor) => {
        const homeX = (actor.xPct / 100) * w;
        const homeY = (actor.yPct / 100) * h;
        const prev = prevPlayers.find((p) => p.actor.seed === actor.seed);
        if (prev) {
          const ox = prev.homeX || 1;
          const oy = prev.homeY || 1;
          return {
            ...prev,
            actor,
            homeX,
            homeY,
            x: homeX + (prev.x - prev.homeX) * (homeX / ox || 1),
            y: homeY + (prev.y - prev.homeY) * (homeY / oy || 1),
          };
        }
        const jitter = hash01(actor.seed);
        return {
          actor,
          homeX,
          homeY,
          x: homeX + (jitter - 0.5) * 10,
          y: homeY + (hash01(actor.seed + 'y') - 0.5) * 8,
          vx: 0,
          vy: 0,
          facing: (actor.xPct >= 50 ? -1 : 1) as 1 | -1,
          pose: 'idle' as Pose,
          kickUntil: 0,
        };
      });

      const findIdx = (seed: string | null) =>
        seed == null ? -1 : players.findIndex((p) => p.actor.seed === seed);

      const hIdx = findIdx(prevHolderSeed);
      ball.holder = hIdx >= 0 ? hIdx : null;
      const iIdx = findIdx(prevIntendedSeed);
      ball.intended = iIdx >= 0 ? iIdx : null;
      const nIdx = findIdx(prevNoPickupSeed);
      ball.noPickupIdx = nIdx >= 0 ? nIdx : null;

      if (ball.holder != null && players[ball.holder]) {
        const foot = footOf(players[ball.holder]!);
        if (Math.hypot(ball.vx, ball.vy) < 5) {
          ball.x = foot.x;
          ball.y = foot.y;
        }
      }
    };

    /** Full reset — only when roster really changes. Same seeds → soft update. */
    const rebuild = (reason: string) => {
      if (w < 2 || h < 2) return;
      const list = actorsRef.current;

      // Soft path: same players still on pitch — keep possession (refetch-safe)
      if (inited && players.length > 0 && list.length === players.length) {
        const prevBySeed = new Map(players.map((p) => [p.actor.seed, p]));
        const allSame = list.every((a) => prevBySeed.has(a.seed));
        if (allSame) {
          const prevHolderSeed =
            ball.holder != null && players[ball.holder] ? players[ball.holder]!.actor.seed : null;
          const prevIntendedSeed =
            ball.intended != null && players[ball.intended]
              ? players[ball.intended]!.actor.seed
              : null;
          const prevNoPickupSeed =
            ball.noPickupIdx != null && players[ball.noPickupIdx]
              ? players[ball.noPickupIdx]!.actor.seed
              : null;
          const prevPasserSeed =
            lastPasser != null && players[lastPasser] ? players[lastPasser]!.actor.seed : null;
          const prevRecentSeeds = recentHolders
            .map((i) => players[i]?.actor.seed)
            .filter((s): s is string => !!s);

          players = list.map((actor) => {
            const prev = prevBySeed.get(actor.seed)!;
            const homeX = (actor.xPct / 100) * w;
            const homeY = (actor.yPct / 100) * h;
            return {
              ...prev,
              actor,
              homeX,
              homeY,
              x: homeX + (prev.x - prev.homeX),
              y: homeY + (prev.y - prev.homeY),
            };
          });

          const findIdx = (seed: string | null) =>
            seed == null ? -1 : players.findIndex((p) => p.actor.seed === seed);
          const hIdx = findIdx(prevHolderSeed);
          ball.holder = hIdx >= 0 ? hIdx : null;
          const iIdx = findIdx(prevIntendedSeed);
          ball.intended = iIdx >= 0 ? iIdx : null;
          const nIdx = findIdx(prevNoPickupSeed);
          ball.noPickupIdx = nIdx >= 0 ? nIdx : null;
          const pIdx = findIdx(prevPasserSeed);
          lastPasser = pIdx >= 0 ? pIdx : null;
          recentHolders = prevRecentSeeds
            .map((s) => players.findIndex((p) => p.actor.seed === s))
            .filter((i) => i >= 0);
          return;
        }
      }

      players = list.map((actor) => {
        const homeX = (actor.xPct / 100) * w;
        const homeY = (actor.yPct / 100) * h;
        const jitter = hash01(actor.seed);
        return {
          actor,
          homeX,
          homeY,
          x: homeX + (jitter - 0.5) * 10,
          y: homeY + (hash01(actor.seed + 'y') - 0.5) * 8,
          vx: 0,
          vy: 0,
          facing: (actor.xPct >= 50 ? -1 : 1) as 1 | -1,
          pose: 'idle' as Pose,
          kickUntil: 0,
        };
      });

      if (players.length === 0) {
        ball = {
          x: w * 0.5,
          y: h * 0.55,
          vx: 0,
          vy: 0,
          holder: null,
          intended: null,
          noPickupIdx: null,
          noPickupUntil: 0,
          passCooldown: 1,
          z: 0,
          vz: 0,
          looseStill: 0,
        };
        inited = true;
        return;
      }

      let start = 0;
      let bestDef = Infinity;
      const realCount = players.filter((p) => !p.actor.ghost).length;
      players.forEach((p, i) => {
        const role = roleKey(p);
        // With thin lineups, the only real player may be GK — still give them the ball
        if (role === 'GK' && !(realCount <= 2 && !p.actor.ghost)) return;
        const d = Math.hypot(p.homeX - w * 0.5, p.homeY - h * 0.72);
        const bias = role === 'DEF' ? -80 : role === 'MID' ? -20 : 40;
        const realBoost = p.actor.ghost ? 200 : -120;
        if (d + bias + realBoost < bestDef) {
          bestDef = d + bias + realBoost;
          start = i;
        }
      });
      // Absolute fallback: prefer any real starter over ghosts
      const realIdx = players.findIndex((p) => !p.actor.ghost);
      if (realIdx >= 0 && (players[start]?.actor.ghost || bestDef === Infinity)) {
        start = realIdx;
      }
      const holder = players[start]!;
      const foot = {
        x: holder.x + holder.facing * playScale() * 2.4,
        y: holder.y + playScale() * 12.5,
      };
      ball = {
        x: foot.x,
        y: foot.y,
        vx: 0,
        vy: 0,
        holder: start,
        intended: null,
        noPickupIdx: null,
        noPickupUntil: 0,
        passCooldown: 0.55 + hash01(holder.actor.seed) * 0.45,
        z: 0,
        vz: 0,
        looseStill: 0,
      };
      recentHolders = [start];
      passCount = 0;
      lastPasser = null;
      inited = true;
    };

    const steerToward = (p: SimPlayer, tx: number, ty: number, speedMul: number, dt: number) => {
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const maxSp = SPEED * speedMul * (p.actor.slotRole === 'GK' || p.actor.position === 'GK' ? 0.72 : 1);
      const ax = (dx / d) * ACCEL * speedMul;
      const ay = (dy / d) * ACCEL * speedMul;
      p.vx += ax * dt;
      p.vy += ay * dt;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > maxSp) {
        p.vx = (p.vx / sp) * maxSp;
        p.vy = (p.vy / sp) * maxSp;
      }
    };

    const applyFriction = (p: SimPlayer, dt: number) => {
      const damp = Math.exp(-FRICTION * dt);
      p.vx *= damp;
      p.vy *= damp;
    };

    /** Each team runs its half, and can still reach the mark you placed. */
    const sideX = (p: SimPlayer, x: number) => {
      if (p.actor.side === 'away') {
        const min = Math.min(w * 0.46, p.homeX - w * 0.12);
        return clamp(x, Math.max(w * 0.08, min), w * 0.96);
      }
      const max = Math.max(w * 0.54, p.homeX + w * 0.12);
      return clamp(x, w * 0.04, Math.min(w * 0.92, max));
    };

    const pickPassTarget = (from: number): number | null => {
      if (players.length < 2) return null;
      const me = players[from]!;
      const meRole = roleKey(me);
      const realCount = players.filter((p) => !p.actor.ghost).length;
      // Rotate intent so ball visits whole pitch, not just mid triangle
      let mode = passCount % 5;
      if (meRole === 'FW') {
        const finishing = me.actor.finishing ?? 1;
        if (hash01(`${me.actor.seed}:shot:${passCount}`) < Math.min(0.85, finishing * 0.45)) mode = 4;
      }
      // 0 = forward, 1 = wide switch, 2 = back/build, 3 = other wing, 4 = through to FW

      let best = -1;
      let bestScore = -Infinity;

      const attackOther = passCount > 0 && passCount % 5 === 4;

      for (let i = 0; i < players.length; i++) {
        if (i === from) continue;
        const t = players[i]!;
        const sameSide = (me.actor.side ?? 'home') === (t.actor.side ?? 'home');
        if (attackOther ? sameSide : !sameSide) continue;
        const tRole = roleKey(t);
        const tGhost = !!t.actor.ghost;
        // Skip GK only when the pitch is full of real outfielders
        if (tRole === 'GK' && tGhost) continue;
        if (tRole === 'GK' && realCount > 3 && !(mode === 2 && meRole === 'DEF')) continue;

        // Prefer formation slots (home) so passes span the pitch
        const dHome = Math.hypot(t.homeX - me.homeX, t.homeY - me.homeY);
        if (dHome < 40 && tGhost) continue;
        if (dHome < 28 && !tGhost) continue;

        const dx = t.homeX - me.homeX;
        const dy = t.homeY - me.homeY; // +dy = toward own goal / defense in this layout
        const forward = -dy; // toward attack
        const lateral = Math.abs(dx);

        let score = hash01(`${me.actor.seed}-${t.actor.seed}-${passCount}`) * 40;

        // Keep the ball mostly in the same XI so the match reads as 2 teams
        if (sameSide) score += 260;
        else score -= 180;

        // Real starters must see the ball — ghosts are only fillers
        if (!tGhost) score += 220;
        else score -= 40;

        // Strongly avoid recent holders
        const recentIdx = recentHolders.lastIndexOf(i);
        if (recentIdx >= 0) score -= (recentHolders.length - recentIdx) * 120;
        if (tRole === meRole && tGhost) score -= 50;

        // Prefer medium/long switches over short mid triangles
        score += clamp(dHome, 60, 280) * 0.55;

        if (mode === 0) {
          // Push up
          score += forward * 2.4;
          if (tRole === 'FW') score += 90;
          if (tRole === 'MID') score += 35;
        } else if (mode === 1 || mode === 3) {
          // Switch play wide
          score += lateral * 2.8;
          score += forward * 0.4;
          if (Math.sign(dx) !== Math.sign(me.homeX - w * 0.5) || Math.abs(dx) > 80) score += 70;
        } else if (mode === 2) {
          // Recycle back
          score += dy * 2.2;
          if (tRole === 'DEF') score += 100;
          if (tRole === 'GK') score += 40;
          if (tRole === 'FW') score -= 40;
        } else {
          // Through ball / find ATA
          score += forward * 3.2 + lateral * 0.6;
          if (tRole === 'FW') score += 130;
          if (tRole === 'MID') score += 20;
        }

        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }

      if (best < 0) {
        // Fallback: furthest non-recent teammate by home slot — prefer real
        let far = -1;
        let farD = -1;
        for (let i = 0; i < players.length; i++) {
          if (i === from) continue;
          const sameSide = (me.actor.side ?? 'home') === (players[i]!.actor.side ?? 'home');
          if (attackOther ? sameSide : !sameSide) continue;
          if (roleKey(players[i]!) === 'GK' && players[i]!.actor.ghost) continue;
          if (recentHolders.includes(i) && recentHolders.length < players.length - 1) continue;
          const d = Math.hypot(players[i]!.homeX - me.homeX, players[i]!.homeY - me.homeY);
          const boost = players[i]!.actor.ghost ? 0 : 80;
          if (d + boost > farD) {
            farD = d + boost;
            far = i;
          }
        }
        best = far >= 0 ? far : (from + 1) % players.length;
      }
      return best;
    };

    const launchPass = (from: number, to: number) => {
      const a = players[from]!;
      const b = players[to]!;
      const foot = footOf(a);
      // Aim near where the receiver actually is (slight home lead) — don't dump midfield voids
      const aimX = lerp(b.x, b.homeX, 0.2);
      const aimY = lerp(b.y, b.homeY, 0.2) + playScale() * 12.5;
      const dx = aimX - foot.x;
      const dy = aimY - foot.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = clamp(220 + d * 0.7, 180, 360);
      ball.holder = null;
      ball.intended = to;
      ball.looseStill = 0;
      // Kick ball clear of passer feet + block re-grab
      ball.x = foot.x + (dx / d) * 28;
      ball.y = foot.y + (dy / d) * 18;
      ball.vx = (dx / d) * speed;
      ball.vy = (dy / d) * speed;
      ball.z = 12;
      ball.vz = 60 + d * 0.1;
      ball.noPickupIdx = from;
      ball.noPickupUntil = elapsed + 0.85;
      a.pose = 'kick';
      a.kickUntil = elapsed + KICK_HOLD;
      a.facing = dx >= 0 ? 1 : -1;
      a.vx += (dx / d) * 70;
      a.vy += (dy / d) * 50;
      ball.passCooldown = PASS_MIN + hash01(a.actor.seed + String(elapsed)) * (PASS_MAX - PASS_MIN);
      passCount += 1;
      lastPasser = from;
      recentHolders.push(from);
      if (recentHolders.length > 5) recentHolders.shift();
    };

    const giveBallTo = (i: number) => {
      const p = players[i];
      if (!p) return;
      ball.holder = i;
      ball.intended = null;
      ball.looseStill = 0;
      ball.noPickupIdx = null;
      ball.noPickupUntil = 0;
      ball.vx = 0;
      ball.vy = 0;
      ball.z = 0;
      ball.passCooldown = PASS_MIN + 0.12;
      const foot = footOf(p);
      ball.x = foot.x;
      ball.y = foot.y;
      p.pose = 'kick';
      p.kickUntil = elapsed + 0.16;
      recentHolders.push(i);
      if (recentHolders.length > 5) recentHolders.shift();
    };

    const nearestToBall = (): number => {
      let bestI = 0;
      let bestD = Infinity;
      for (let i = 0; i < players.length; i++) {
        const foot = footOf(players[i]!);
        const d = Math.hypot(foot.x - ball.x, foot.y - ball.y);
        const gkPenalty = roleKey(players[i]!) === 'GK' ? 40 : 0;
        if (d + gkPenalty < bestD) {
          bestD = d + gkPenalty;
          bestI = i;
        }
      }
      return bestI;
    };

    const step = (dt: number) => {
      if (players.length === 0) return;

      elapsed += dt;

      // Vestiário / lineup edit: idle near home — no ball
      if (!livePlayRef.current) {
        for (let i = 0; i < players.length; i++) {
          const p = players[i]!;
          const phase = elapsed * (0.55 + hash01(p.actor.seed) * 0.35) + p.actor.index * 1.7;
          const tx = p.homeX + Math.sin(phase) * 10;
          const ty = p.homeY + Math.cos(phase * 0.78) * 6;
          steerToward(p, tx, ty, 0.4, dt);
          applyFriction(p, dt);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.x = sideX(p, p.x);
          p.y = clamp(p.y, h * 0.08, h * 0.94);
          const spd = Math.hypot(p.vx, p.vy);
          p.pose = spd > 20 ? 'run' : 'idle';
          if (Math.abs(p.vx) > 8) p.facing = p.vx >= 0 ? 1 : -1;
        }
        return;
      }

      ball.passCooldown = Math.max(0, ball.passCooldown - dt);


      // Separation
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const a = players[i]!;
          const b = players[j]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < SEP_R) {
            const push = ((SEP_R - d) / SEP_R) * SEP_FORCE * dt;
            const nx = dx / d;
            const ny = dy / d;
            a.vx -= nx * push;
            a.vy -= ny * push;
            b.vx += nx * push;
            b.vy += ny * push;
          }
        }
      }

      const ballTx = ball.holder != null ? players[ball.holder]!.x : ball.x;
      const ballTy = ball.holder != null ? players[ball.holder]!.y : ball.y;

      for (let i = 0; i < players.length; i++) {
        const p = players[i]!;
        if (p.kickUntil > elapsed) {
          p.pose = 'kick';
          applyFriction(p, dt);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.x = sideX(p, p.x);
          p.y = clamp(p.y, h * 0.08, h * 0.94);
          continue;
        }

        const isHolder = ball.holder === i;
        const isIntended = ball.holder == null && ball.intended === i;
        const distBall = Math.hypot(ballTx - p.x, ballTy - p.y);
        const isGk = p.actor.slotRole === 'GK' || p.actor.position === 'GK';
        const ballOnMyHalf = (p.actor.side === 'away') === (ballTx >= w * 0.5);

        let tx = p.homeX;
        let ty = p.homeY;
        let mul = 0.7;
        let freeChase = false;

        if (isHolder) {
          const side = hash01(p.actor.seed + 'side') > 0.5 ? 1 : -1;
          tx = sideX(p, p.homeX + side * (36 + hash01(p.actor.seed) * 48));
          ty = clamp(p.homeY + (hash01(p.actor.seed + 'up') - 0.5) * 36, h * 0.12, h * 0.88);
          mul = 1;
        } else if (ballOnMyHalf && (isIntended || (!isGk && ball.holder == null && distBall < CHASE_RADIUS * 1.25))) {
          // Sprint to the actual ball — intended receiver ignores formation tether
          tx = ball.x;
          ty = ball.y;
          mul = isIntended ? 1.55 : 1.25;
          freeChase = isIntended || distBall < 70;
        } else if (ballOnMyHalf && !isGk && ball.holder != null && distBall < CHASE_RADIUS * 1.1) {
          const hold = players[ball.holder]!;
          tx = lerp(p.homeX, hold.x, 0.45);
          ty = lerp(p.homeY, hold.y, 0.35);
          mul = 0.9;
        } else if (!isGk) {
          const press = ball.holder != null ? 0.5 : 0.22;
          tx = lerp(p.homeX, ballTx, press);
          ty = lerp(p.homeY, ballTy, press * 0.65);
          mul = 0.95;
        } else {
          const phase = elapsed * 0.9 + p.actor.index;
          tx = p.homeX + Math.sin(phase) * 10;
          ty = p.homeY + Math.cos(phase * 1.1) * 6;
          mul = 0.45;
        }

        const toHome = Math.hypot(p.homeX - p.x, p.homeY - p.y);
        if (!freeChase) {
          if (toHome > MAX_HOME_DRIFT && !isHolder) {
            tx = p.homeX;
            ty = p.homeY;
            mul = 1.1;
          } else {
            tx = lerp(tx, p.homeX, isHolder ? 0.05 : 0.1);
            ty = lerp(ty, p.homeY, isHolder ? 0.05 : 0.1);
          }
        }

        tx = sideX(p, tx);
        steerToward(p, tx, ty, mul, dt);
        applyFriction(p, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.x = sideX(p, p.x);
        p.y = clamp(p.y, h * 0.08, h * 0.94);

        const spd = Math.hypot(p.vx, p.vy);
        if (spd > 14) {
          p.pose = 'run';
          if (Math.abs(p.vx) > 12) p.facing = p.vx >= 0 ? 1 : -1;
        } else if (spd < 16) {
          p.pose = 'idle';
        }

        if (!isHolder && !freeChase && toHome > MAX_HOME_DRIFT) {
          p.vx += ((p.homeX - p.x) / toHome) * HOME_PULL * dt;
          p.vy += ((p.homeY - p.y) / toHome) * HOME_PULL * dt;
        }
      }

      const minSep = h * 0.1;
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const a = players[i]!;
          const b = players[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy) || 0.01;
          if (d >= minSep) continue;
          const push = (minSep - d) * 0.35;
          const nx = dx / d;
          const ny = dy / d;
          a.x = sideX(a, a.x + nx * push);
          a.y = clamp(a.y + ny * push, h * 0.2, h * 0.8);
          b.x = sideX(b, b.x - nx * push);
          b.y = clamp(b.y - ny * push, h * 0.2, h * 0.8);
        }
      }

      // Ball physics / possession
      if (ball.holder != null && players[ball.holder]) {
        const hold = players[ball.holder]!;
        const foot = footOf(hold);
        if (players.length < 2) {
          // Solo starter: no pass partner — juggle/dribble so it never looks "frozen on one"
          const phase = elapsed * 3.4;
          const s = playScale();
          ball.x = foot.x + Math.cos(phase) * s * 4.2;
          ball.y = foot.y + Math.sin(phase * 1.35) * s * 2.6;
          ball.z = 6 + Math.abs(Math.sin(phase * 2.1)) * 14;
          ball.vx = 0;
          ball.vy = 0;
          ball.looseStill = 0;
          hold.pose = 'run';
        } else {
          ball.x = foot.x;
          ball.y = foot.y;
          ball.vx = 0;
          ball.vy = 0;
          ball.z = 0;
          ball.looseStill = 0;
          if (ball.passCooldown <= 0) {
            const target = pickPassTarget(ball.holder);
            if (target != null) launchPass(ball.holder, target);
            else ball.passCooldown = 0.25;
          }
        }
      } else {
        ball.vx *= Math.exp(-1.15 * dt);
        ball.vy *= Math.exp(-1.15 * dt);
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.vz -= 520 * dt;
        ball.z += ball.vz * dt;
        if (ball.z < 0) {
          ball.z = 0;
          ball.vz *= -0.35;
          if (Math.abs(ball.vz) < 18) ball.vz = 0;
        }
        ball.x = clamp(ball.x, w * 0.05, w * 0.95);
        ball.y = clamp(ball.y, h * 0.1, h * 0.92);

        const ballSp = Math.hypot(ball.vx, ball.vy);
        if (ballSp < 35) ball.looseStill += dt;
        else ball.looseStill = 0;

        // Pickup — prefer intended; never re-grab by passer during grace
        const pickR = PICKUP_RADIUS + playScale() * 3;
        let bestI = -1;
        let bestD = pickR;
        for (let i = 0; i < players.length; i++) {
          if (ball.noPickupIdx === i && elapsed < ball.noPickupUntil) continue;
          const foot = footOf(players[i]!);
          const gkReach = roleKey(players[i]!) === 'GK' ? (players[i]!.actor.goalkeeping ?? 1) * 22 : 0;
          const d = Math.hypot(foot.x - ball.x, foot.y - ball.y) - gkReach;
          const isIntended = ball.intended === i;
          const bonus = isIntended ? 18 : 0;
          const canPick =
            ballSp < 120 || (isIntended && d < pickR + 10) || (ballSp < 200 && d < 10 && ball.looseStill > 0.05);
          if (d - bonus < bestD && canPick) {
            bestD = d - bonus;
            bestI = i;
          }
        }
        if (bestI >= 0) {
          giveBallTo(bestI);
        } else if (ball.looseStill > 0.4) {
          // Orphaned ball: complete the pass to intended, never bounce back to passer
          let claim: number;
          if (ball.intended != null && ball.intended !== ball.noPickupIdx) {
            claim = ball.intended;
          } else {
            claim = nearestToBall();
            if (claim === lastPasser || (ball.noPickupIdx === claim && elapsed < ball.noPickupUntil)) {
              let best = claim;
              let bestDd = Infinity;
              for (let k = 0; k < players.length; k++) {
                if (k === lastPasser || k === ball.noPickupIdx) continue;
                if (roleKey(players[k]!) === 'GK') continue;
                const f = footOf(players[k]!);
                const dd = Math.hypot(f.x - ball.x, f.y - ball.y);
                if (dd < bestDd) {
                  bestDd = dd;
                  best = k;
                }
              }
              claim = best;
            }
          }
          giveBallTo(claim);
        }
      }
    };

    const tick = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const sizeChanged = resize();
        const list = actorsRef.current;
        const key = list.map((a) => `${a.slotId}:${a.seed}:${a.xPct}:${a.yPct}`).join('|');
        if (!inited || key !== lastActorsKey || players.length !== list.length) {
          lastActorsKey = key;
          rebuild('actors-change');
        } else if (sizeChanged) {
          syncLayout();
        }

        const dt = Math.min(0.033, Math.max(0.008, (now - last) / 1000));
        last = now;
        if (plantRef.current) {
          elapsed += dt;
          const timeSec = now / 1000;
          for (const p of players) {
            p.y = p.homeY;
            p.vx = 0;
            p.vy = 0;
            if (reduceMotion) {
              p.x = p.homeX;
              p.pose = 'idle';
              continue;
            }
            const pace = lockerPace(p.actor.seed, p.actor.index, timeSec, p.actor.xPct);
            p.x = (pace.xPct / 100) * w;
            p.pose = pace.moving ? 'run' : 'idle';
            p.facing = pace.facing;
          }
        } else if (livePlayRef.current && !reduceMotion) {
          step(dt);
        } else {
          for (const p of players) {
            p.x = p.homeX;
            p.y = p.homeY;
            p.vx = 0;
            p.vy = 0;
            p.pose = 'idle';
          }
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = false;

        const scale = playScale();
        const sorted = [...players].sort((a, b) => a.y - b.y);
        const tMs = elapsed * 1000;
        const staminaBySlot = new Map(actorsRef.current.map((actor) => [actor.slotId, actor.staminaPct]));

        for (const p of sorted) {
          const freshStamina = staminaBySlot.get(p.actor.slotId);
          if (freshStamina != null) p.actor.staminaPct = freshStamina;
          const drawn = plantRef.current ? Math.min(4.2, Math.max(1.25, Math.min(h / 105, w / (Math.max(1, players.length) * 38)))) : scale;
          const distance = Math.hypot(p.x - (p.drawX ?? p.x), p.y - (p.drawY ?? p.y));
          p.drawX = p.x;
          p.drawY = p.y;
          p.gaitMs = advanceSpriteGait(p.gaitMs ?? hash01(p.actor.seed) * 500, distance, dt, drawn);
          const bars = staminaBarsRef.current && !plantRef.current;
          drawPlayfieldPlayer(ctx, p.actor, p.x, p.y, tMs, p.pose, p.facing, drawn, undefined, {
            nameplate: bars ? false : nameplatesRef.current,
            nameplateScale: plantRef.current ? 2.1 : undefined,
            staminaBar: bars,
            spriteMotion: { gaitMs: p.gaitMs, reducedMotion: reduceMotion },
          });
        }

        if (livePlayRef.current && !plantRef.current && players.length > 0) {
          drawPlayfieldBall(ctx, ball.x, ball.y - ball.z * 0.35, tMs, scale);
        }
      } catch {
        // keep loop alive
      }
    };

    resize();
    rebuild('init');
    lastActorsKey = actorsRef.current.map((a) => `${a.slotId}:${a.seed}:${a.xPct}:${a.yPct}`).join('|');
    const ro = new ResizeObserver(() => {
      if (resize()) syncLayout();
    });
    ro.observe(parent);
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      motionQuery.removeEventListener('change', onMotion);
    };
  }, [actorsKey]);


  return (
    <canvas
      ref={canvasRef}
      className="stadium-playfield-layer pointer-events-none absolute inset-0 z-[19]"
      aria-hidden
    />
  );
}
