import { shortPlayerNickname } from '../../lib/playerNickname';
import { RARITY_HEX, normalizeBonecoRarity, type BonecoRarity } from './stadiumBonecoTheme';
import { drawAwayRivalSprite, readyAwaySprites, type BonecoKit } from './awayRivalSprites';
import type { SpriteMotion } from './playerSpriteMotion';
import { drawCardBoneco } from './cardBonecoCutout';

export interface PlayfieldActor {
  slotId: string;
  xPct: number;
  yPct: number;
  rarity: string;
  /** Player position from DTO */
  position: string;
  /** Stadium slot role — preferred for kit color */
  slotRole?: string;
  name: string;
  /** Card art. Selects the generated character animation atlas. */
  imageUrl?: string | null;
  overwall: number;
  /** Finalização / OVERWALL. 1 is average for the band. */
  finishing?: number;
  /** Atributo de goleiro / OVERWALL. */
  goalkeeping?: number;
  /** Career age when available (base players). */
  age?: number | null;
  /** 0–100. Drawn as the bar under the feet on the match pitch. */
  staminaPct?: number;
  seed: string;
  index: number;
  /** Visual-only practice partner when lineup has <2 starters. */
  ghost?: boolean;
  /** Which half the player belongs to. Kit follows the role, on both sides. */
  side?: 'home' | 'away';
}

const OUT = '#0b1020';

const SKINS = [
  { base: '#f5d0a8', shade: '#d4a07a', hi: '#ffe8cc', lip: '#c47860' },
  { base: '#e8b888', shade: '#c49060', hi: '#f5d0a8', lip: '#b07050' },
  { base: '#c99068', shade: '#a07048', hi: '#e0b088', lip: '#905840' },
  { base: '#8b5a3c', shade: '#6a4028', hi: '#a87850', lip: '#5a3020' },
  { base: '#5c3a28', shade: '#3e2418', hi: '#7a5040', lip: '#2e1810' },
] as const;

/** Kit keyed by field role — clear color language on dirt pitch */
const ROLE_KIT: Record<
  string,
  { shirt: string; hi: string; lo: string; shorts: string; socks: string; trim: string }
> = {
  GK: { shirt: '#f59e0b', hi: '#fcd34d', lo: '#b45309', shorts: '#1e293b', socks: '#fbbf24', trim: '#fff7ed' },
  GOL: { shirt: '#f59e0b', hi: '#fcd34d', lo: '#b45309', shorts: '#1e293b', socks: '#fbbf24', trim: '#fff7ed' },
  DEF: { shirt: '#1d4ed8', hi: '#60a5fa', lo: '#1e3a8a', shorts: '#0f172a', socks: '#93c5fd', trim: '#eff6ff' },
  ZAG: { shirt: '#1d4ed8', hi: '#60a5fa', lo: '#1e3a8a', shorts: '#0f172a', socks: '#93c5fd', trim: '#eff6ff' },
  LAT: { shirt: '#0e7490', hi: '#67e8f9', lo: '#155e75', shorts: '#082f49', socks: '#a5f3fc', trim: '#ecfeff' },
  MID: { shirt: '#15803d', hi: '#4ade80', lo: '#14532d', shorts: '#052e16', socks: '#86efac', trim: '#f0fdf4' },
  MEI: { shirt: '#15803d', hi: '#4ade80', lo: '#14532d', shorts: '#052e16', socks: '#86efac', trim: '#f0fdf4' },
  FW: { shirt: '#b91c1c', hi: '#f87171', lo: '#7f1d1d', shorts: '#1c1917', socks: '#fca5a5', trim: '#fef2f2' },
  ATA: { shirt: '#b91c1c', hi: '#f87171', lo: '#7f1d1d', shorts: '#1c1917', socks: '#fca5a5', trim: '#fef2f2' },
};

const HAIR: Record<BonecoRarity, string[]> = {
  common: ['#1c1917', '#44403c', '#78716c'],
  uncommon: ['#14532d', '#365314', '#3f6212'],
  rare: ['#0f172a', '#1e3a8a', '#334155'],
  'super-rare': ['#2e1065', '#4c1d95', '#1e1b4b'],
  epic: ['#78350f', '#92400e', '#451a03'],
  legendary: ['#450a0a', '#7f1d1d', '#1c1917'],
  mythic: ['#022c22', '#064e3b', '#134e4a'],
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function resolveRole(actor: PlayfieldActor): string {
  const raw = String(actor.slotRole || actor.position || 'MID').toUpperCase();
  if (raw in ROLE_KIT) return raw;
  return 'MID';
}

function r(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

/** Black outline behind a filled rect */
function block(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
) {
  r(ctx, x - 1, y, w + 2, h, OUT);
  r(ctx, x, y - 1, w, h + 2, OUT);
  r(ctx, x, y, w, h, fill);
}

/**
 * Higher-detail coded pixel footballer.
 * Drawn in local space (~14×28), then scaled. Feet at origin.
 */
export function drawPlayfieldPlayer(
  ctx: CanvasRenderingContext2D,
  actor: PlayfieldActor,
  worldX: number,
  worldY: number,
  time: number,
  pose: 'idle' | 'run' | 'kick',
  facing: 1 | -1,
  scale = 2.35,
  /** Optional label (e.g. H1 / GK). Defaults to overwall. */
  badgeText?: string,
  opts?: { ground?: boolean; nameplate?: boolean; nameplateScale?: number; staminaBar?: boolean; spriteMotion?: SpriteMotion },
) {
  const rarity = normalizeBonecoRarity(actor.rarity);
  const glow = RARITY_HEX[rarity];
  const role = resolveRole(actor);
  const kit = ROLE_KIT[role] ?? ROLE_KIT.MID!;
  const hid = hash(actor.seed);
  const skin = SKINS[hid % SKINS.length]!;
  const hairList = HAIR[rarity] ?? HAIR.common;
  const hair = hairList[hid % hairList.length] ?? '#1c1917';
  const hairStyle = hid % 5;
  const isGk = role === 'GK' || role === 'GOL';

  const phase = time * (pose === 'run' ? 0.012 : 0.0035) + actor.index * 1.9;
  const running = pose === 'run';
  const kicking = pose === 'kick';

  // Limb motion in local px — keep small so scale (~4×) doesn't look broken
  const stride = running ? Math.sin(phase) : 0;
  const leg = kicking ? 3.2 : running ? stride * 2.4 : 0;
  const arm = kicking ? 1.6 : running ? -stride * 1.8 : 0;
  const lean = kicking ? -0.06 : running ? stride * 0.02 : 0;
  const cardSprite = actor.side !== 'away' && !!actor.imageUrl;
  const bob = cardSprite || kicking ? 0 : running ? Math.round(Math.abs(Math.sin(phase * 2))) : 0;

  const cx = Math.round(worldX);
  const cy = Math.round(worldY) - bob;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale * facing, scale);
  ctx.imageSmoothingEnabled = false;
  if (actor.ghost) ctx.globalAlpha = 0.78;

  if (actor.side !== 'away' && actor.imageUrl) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 15, 9, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (drawCardBoneco(ctx, actor.imageUrl, time, pose, opts?.spriteMotion)) {
      ctx.restore();
      finishPlayerMarker(ctx, cx, cy, actor, glow, scale, badgeText, opts);
      return;
    }
  }

  if (readyAwaySprites()) {
    const kit: BonecoKit =
      actor.side === 'away'
        ? 'yellow'
        : role === 'GK' || role === 'GOL'
          ? 'gold'
          : role === 'DEF' || role === 'ZAG'
            ? 'blue'
            : role === 'LAT'
              ? 'cyan'
              : role === 'FW' || role === 'ATA'
                ? 'red'
                : 'green';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 15, 8, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (drawAwayRivalSprite(ctx, pose, time, kit)) {
      ctx.restore();
      finishPlayerMarker(ctx, cx, cy, actor, glow, scale, badgeText, opts);
      return;
    }
  }

  ctx.rotate(lean);

  if (opts?.ground !== false) {
    const ringBoost = rarity === 'common' ? 0 : rarity === 'mythic' ? 3 : 1.5;
    ctx.fillStyle = `${glow}${rarity === 'common' ? '38' : '58'}`;
    ctx.beginPath();
    ctx.ellipse(0, 15, 9 + ringBoost, 2.8 + ringBoost * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    if (rarity !== 'common') {
      ctx.strokeStyle = glow;
      ctx.lineWidth = rarity === 'legendary' || rarity === 'mythic' ? 1.4 : 1;
      ctx.beginPath();
      ctx.ellipse(0, 15, 9 + ringBoost, 2.8 + ringBoost * 0.15, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 14.5, isGk ? 8.5 : 7.5, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft rarity backlight
  if (rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic') {
    const g = ctx.createRadialGradient(0, 2, 1, 0, 2, 16);
    g.addColorStop(0, `${glow}40`);
    g.addColorStop(1, `${glow}00`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 2, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  const L = Math.round(leg);
  const A = Math.round(arm);
  // Kick: plant foot vs striking foot (forward)
  const plant = kicking ? -1 : L;
  const strike = kicking ? 4 : -L;

  // ── Legs ──
  block(ctx, -3 + plant, 7, 3, 5, kit.socks);
  block(ctx, 1 + strike, 7, 3, kicking ? 4 : 5, kit.socks);
  r(ctx, -2 + plant, 7, 1, 3, '#ffffff44');
  r(ctx, 2 + strike, 7, 1, 3, '#ffffff44');

  // Boots
  block(ctx, -4 + plant, 11, 5, 3, '#111827');
  block(ctx, 0 + strike, kicking ? 10 : 11, 5, 3, '#111827');
  r(ctx, -3 + plant, 11, 2, 1, '#4b5563');
  r(ctx, 1 + strike, kicking ? 10 : 11, 2, 1, '#4b5563');

  // Shorts
  block(ctx, -4, 3, 9, 5, kit.shorts);
  r(ctx, 0, 3, 1, 5, 'rgba(0,0,0,0.35)');
  r(ctx, -3, 3, 3, 1, '#ffffff18');

  // Torso
  block(ctx, -5, -4, 11, 8, kit.lo);
  r(ctx, -4, -3, 9, 6, kit.shirt);
  r(ctx, -3, -2, 4, 3, kit.hi);
  r(ctx, 2, -2, 2, 4, kit.lo);
  // collar
  r(ctx, -2, -4, 5, 2, kit.trim);
  r(ctx, -4, -1, 9, 1, glow);
  // tiny crest
  r(ctx, -1, 0, 3, 2, glow);
  r(ctx, 0, 0, 1, 1, '#fff');

  // Arms — opposite swing to legs; kick = mild balance pose (not teleport)
  const leftArmY = -2 + A;
  const rightArmY = -2 - A;
  if (isGk) {
    // Goalie gloves only (no double shirt sleeves)
    block(ctx, -8, leftArmY, 3, 4, '#f87171');
    block(ctx, 6, rightArmY, 3, 4, '#f87171');
    block(ctx, -7, leftArmY + 3, 2, 2, skin.base);
    block(ctx, 6, rightArmY + 3, 2, 2, skin.base);
  } else {
    block(ctx, -7, leftArmY, 3, 6, kit.shirt);
    block(ctx, 5, rightArmY, 3, 6, kit.shirt);
    block(ctx, -6, leftArmY + 5, 2, 2, skin.base);
    block(ctx, 5, rightArmY + 5, 2, 2, skin.base);
  }

  // Neck
  block(ctx, -1, -6, 3, 2, skin.base);

  // Head
  block(ctx, -3, -13, 7, 7, skin.base);
  r(ctx, -3, -13, 7, 2, skin.hi);
  r(ctx, -2, -10, 2, 2, skin.shade);
  // eyes
  r(ctx, -2, -11, 2, 2, '#0f172a');
  r(ctx, 1, -11, 2, 2, '#0f172a');
  r(ctx, -2, -11, 1, 1, '#e2e8f0');
  r(ctx, 1, -11, 1, 1, '#e2e8f0');
  // brows
  r(ctx, -2, -12, 2, 1, hair);
  r(ctx, 1, -12, 2, 1, hair);
  // nose / mouth
  r(ctx, 0, -9, 1, 1, skin.shade);
  r(ctx, -1, -7, 3, 1, skin.lip);

  // Hair
  r(ctx, -3, -14, 7, 2, OUT);
  r(ctx, -3, -13, 7, 2, hair);
  if (hairStyle === 0) {
    // short
    r(ctx, -3, -11, 1, 1, hair);
    r(ctx, 3, -11, 1, 1, hair);
  } else if (hairStyle === 1) {
    // side part
    r(ctx, -3, -12, 2, 3, hair);
  } else if (hairStyle === 2) {
    // tall
    r(ctx, -2, -16, 5, 2, hair);
    r(ctx, -1, -17, 3, 1, hair);
  } else if (hairStyle === 3) {
    // curls / afro-ish
    r(ctx, -4, -14, 9, 2, hair);
    r(ctx, -4, -12, 2, 2, hair);
    r(ctx, 3, -12, 2, 2, hair);
  } else {
    // long back
    r(ctx, -3, -11, 2, 3, hair);
    r(ctx, 2, -11, 2, 2, hair);
  }
  // rarity streak
  if (rarity !== 'common') {
    r(ctx, 0, -14, 2, 2, glow);
  }

  // Mythic flaps
  if (rarity === 'mythic') {
    const f = Math.round(Math.sin(time * 0.009 + actor.index) * 1.5);
    r(ctx, -8, -3 + f, 2, 7, `${glow}aa`);
    r(ctx, 7, -3 - f, 2, 7, `${glow}aa`);
  }

  // Sparks
  if (rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic') {
    for (let i = 0; i < 3; i++) {
      const spark = (time * 0.007 + actor.index * 0.25 + i * 0.3) % 1;
      ctx.globalAlpha = 0.9 * (1 - spark);
      r(ctx, -7 + i * 6, -16 - spark * 10, 2, 2, glow);
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
  finishPlayerMarker(ctx, cx, cy, actor, glow, scale, badgeText, opts);
}

function staminaFill(pct: number): string {
  if (pct >= 70) return '#27c45e';
  if (pct >= 40) return '#f0c414';
  return '#f0433a';
}

/**
 * 38×5 chip centered on the boot sole. The footprint stays put;
 * only the bright part grows, so a half bar does not slide off the foot.
 */
function drawStaminaBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pct: number,
  scale: number,
) {
  const clamped = Math.max(0, Math.min(100, pct));
  const w = 38;
  const h = 5;
  const top = Math.round(y + 14.2 * scale);
  const left = Math.round(x - w / 2);
  const fill = Math.max(0, Math.round((w * clamped) / 100));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 0;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(left, top, w, h);
  if (fill > 0) {
    ctx.fillStyle = staminaFill(clamped);
    ctx.fillRect(left, top, fill, h);
  }
  ctx.restore();
}

function finishPlayerMarker(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  actor: PlayfieldActor,
  glow: string,
  scale: number,
  badgeText: string | undefined,
  opts?: { nameplate?: boolean; nameplateScale?: number; staminaBar?: boolean; spriteMotion?: SpriteMotion },
) {
  if (opts?.staminaBar) {
    drawStaminaBar(ctx, cx, cy, actor.staminaPct ?? 100, scale);
    return;
  }
  if (opts?.nameplate === false) return;
  if (actor.ghost) {
    drawCompactBadge(ctx, cx, cy, 'Treino', '#94a3b8', scale);
  } else if (badgeText) {
    drawCompactBadge(ctx, cx, cy, badgeText, glow, scale);
  } else {
    drawPlayerNameplate(ctx, cx, cy, actor, glow, opts?.nameplateScale ?? scale, scale);
  }
}

/** Compact OVR for badges — avoids 5+ digit overflow. */
function formatOvrBadge(overwall: number): string {
  const n = Math.round(Number(overwall) || 0);
  if (n >= 100_000) return `${Math.round(n / 1000)}k`;
  if (n >= 10_000) {
    const k = n / 1000;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(n);
}

function shortDisplayName(name: string): string {
  return shortPlayerNickname(name, null, 'Jogador', 10);
}

function roleAbbrev(actor: PlayfieldActor): string {
  const raw = String(actor.slotRole || actor.position || 'MID').toUpperCase();
  if (raw === 'GK' || raw === 'GOL') return 'GOL';
  if (raw === 'DEF' || raw === 'ZAG') return 'ZAG';
  if (raw === 'MID' || raw === 'MEI') return 'MEI';
  if (raw === 'FW' || raw === 'ATA') return 'ATA';
  return raw.slice(0, 3);
}

/** Landing / override — single compact chip. */
function drawCompactBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  glow: string,
  scale: number,
) {
  const top = y - 18 * scale;
  const long = text.length >= 4;
  const fs = Math.max(9, Math.round((long ? 8 : 9) * Math.min(scale, 2.4)));
  ctx.save();
  ctx.font = `700 ${fs}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const tw = ctx.measureText(text).width;
  const accentW = 3;
  const padL = accentW + 5;
  const padR = 6;
  const h = Math.max(17, Math.round(14 * Math.min(scale * 0.5, 1.3)));
  const w = Math.ceil(tw + padL + padR);

  const left = Math.round(x - w / 2);
  const boxTop = Math.round(top - h / 2);

  ctx.fillStyle = 'rgba(6,10,18,0.94)';
  ctx.fillRect(left, boxTop, w, h);
  ctx.strokeStyle = glow;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(left + 0.5, boxTop + 0.5, w - 1, h - 1);
  ctx.fillStyle = glow;
  ctx.fillRect(left, boxTop, accentW, h);
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(text, left + padL + tw / 2, top);
  ctx.restore();
}

/**
 * Plaquinha no campo: nome + OW + posição (+ idade).
 */
function drawPlayerNameplate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  actor: PlayfieldActor,
  glow: string,
  scale: number,
  liftScale = scale,
) {
  const s = Math.min(scale, 2.6);
  const name = shortDisplayName(actor.name);
  const ovr = formatOvrBadge(actor.overwall);
  const role = roleAbbrev(actor);
  const age =
    actor.age != null && Number.isFinite(actor.age) && actor.age > 0
      ? `${Math.round(actor.age)}a`
      : null;

  const nameFs = Math.max(10, Math.round(9.5 * s * 0.55));
  const ovrFs = Math.max(11, Math.round(11 * s * 0.55));
  const metaFs = Math.max(8, Math.round(8 * s * 0.55));

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.font = `700 ${nameFs}px ui-monospace, monospace`;
  const nameW = ctx.measureText(name).width;

  ctx.font = `800 ${ovrFs}px ui-monospace, monospace`;
  const ovrW = ctx.measureText(ovr).width;
  ctx.font = `700 ${metaFs}px ui-monospace, monospace`;
  const owTagW = ctx.measureText(' OW').width;
  const roleW = ctx.measureText(role).width;
  const ageW = age ? ctx.measureText(` · ${age}`).width : 0;

  const row2W = ovrW + owTagW + 6 + roleW + ageW;
  const contentW = Math.max(nameW, row2W);
  const accentW = 3;
  const padX = 6;
  const padY = 4;
  const rowGap = 2;
  const h = padY * 2 + nameFs + rowGap + ovrFs;
  const w = Math.ceil(accentW + padX + contentW + padX);

  const top = y - 22 * liftScale;
  const left = Math.round(x - w / 2);
  const boxTop = Math.round(top - h);

  ctx.fillStyle = 'rgba(4, 8, 16, 0.92)';
  ctx.fillRect(left, boxTop, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(left + 1, boxTop + 1, w - 2, Math.max(2, Math.round(h * 0.28)));
  ctx.strokeStyle = glow;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(left + 0.5, boxTop + 0.5, w - 1, h - 1);
  ctx.fillStyle = glow;
  ctx.fillRect(left, boxTop, accentW, h);

  const textLeft = left + accentW + padX;
  const nameY = boxTop + padY + nameFs / 2;
  const row2Y = boxTop + padY + nameFs + rowGap + ovrFs / 2;

  ctx.font = `700 ${nameFs}px ui-monospace, monospace`;
  ctx.fillStyle = glow;
  ctx.fillText(name, textLeft, nameY);

  let cursor = textLeft;
  ctx.font = `800 ${ovrFs}px ui-monospace, monospace`;
  ctx.fillStyle = glow;
  ctx.fillText(ovr, cursor, row2Y);
  cursor += ovrW;

  ctx.font = `700 ${metaFs}px ui-monospace, monospace`;
  ctx.fillStyle = 'rgba(226,232,240,0.72)';
  ctx.fillText(' OW', cursor, row2Y);
  cursor += owTagW + 6;

  const chipPadX = 3;
  const chipH = Math.max(12, metaFs + 4);
  const chipW = roleW + chipPadX * 2;
  const chipTop = Math.round(row2Y - chipH / 2);
  ctx.fillStyle = `${glow}33`;
  ctx.fillRect(cursor, chipTop, chipW, chipH);
  ctx.strokeStyle = `${glow}99`;
  ctx.lineWidth = 1;
  ctx.strokeRect(cursor + 0.5, chipTop + 0.5, chipW - 1, chipH - 1);
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(role, cursor + chipPadX, row2Y);
  cursor += chipW;

  if (age) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(` · ${age}`, cursor, row2Y);
  }

  ctx.restore();
}

/**
 * @param playerScale Same scale passed to drawPlayfieldPlayer (~3.5–4.6 on stadium).
 * Ball ≈ player head size — never giant, never a speck.
 */
export function drawPlayfieldBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  playerScale = 4,
) {
  const bob = Math.sin(time * 0.012) * 1.5;
  const by = y + bob;
  // Player sprite is ~28 local units tall; head ≈ 5–6 → ball ≈ that on screen.
  const rad = Math.max(12, Math.min(16, playerScale * 2.8));
  const rx = Math.round(x);
  const ry = Math.round(by);

  if (!Number.isFinite(rx) || !Number.isFinite(ry)) return;

  ctx.imageSmoothingEnabled = false;

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(rx + 1, y + rad * 0.85, rad * 0.9, rad * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // High-contrast ball — must read on dirt pitch
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(rx, ry, rad, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(rx, ry, rad, 0, Math.PI * 2);
  ctx.stroke();

  // Classic black pentagon + seams
  const rot = time * 0.0055;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * Math.PI * 2) / 5 - Math.PI / 2;
    const px = rx + Math.cos(a) * rad * 0.34;
    const py = ry + Math.sin(a) * rad * 0.34;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * Math.PI * 2) / 5 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(rx + Math.cos(a) * rad * 0.36, ry + Math.sin(a) * rad * 0.36);
    ctx.lineTo(rx + Math.cos(a) * rad * 0.88, ry + Math.sin(a) * rad * 0.88);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(rx - rad * 0.34, ry - rad * 0.38, rad * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

export function rarityGlow(rarity: string): string {
  return RARITY_HEX[normalizeBonecoRarity(rarity) as BonecoRarity];
}
