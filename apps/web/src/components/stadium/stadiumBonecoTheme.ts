export type BonecoPose = 'idle' | 'run' | 'kick';
export type BonecoRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'super-rare'
  | 'epic'
  | 'legendary'
  | 'mythic';

export type BonecoPosition = 'GK' | 'DEF' | 'MID' | 'FW' | string;

/** Hex colors aligned with --rarity-* in globals.css */
export const RARITY_HEX: Record<BonecoRarity, string> = {
  common: '#9898a8',
  uncommon: '#65a30d',
  rare: '#5888d8',
  'super-rare': '#9070c8',
  epic: '#e0b028',
  legendary: '#c04848',
  mythic: '#00d4aa',
};

export interface BonecoMotionParams {
  wanderRadiusPct: number;
  runCycleSec: number;
  idleCycleSec: number;
  kickHoldMs: number;
  glowPx: number;
  showTrail: boolean;
  showParticles: boolean;
  bobAmpPx: number;
}

export interface BonecoKitColors {
  skin: string;
  skinShadow: string;
  skinHighlight: string;
  hair: string;
  hairHighlight: string;
  shirt: string;
  shirtShadow: string;
  shirtHighlight: string;
  shorts: string;
  socks: string;
  boots: string;
  outline: string;
  accent: string;
  glow: string;
  gloves: string;
}

const DEFAULT_MOTION: BonecoMotionParams = {
  wanderRadiusPct: 3,
  runCycleSec: 2.8,
  idleCycleSec: 2.2,
  kickHoldMs: 450,
  glowPx: 0,
  showTrail: false,
  showParticles: false,
  bobAmpPx: 4,
};

const MOTION_BY_RARITY: Record<BonecoRarity, Partial<BonecoMotionParams>> = {
  common: {},
  uncommon: { wanderRadiusPct: 3.3, runCycleSec: 2.6, bobAmpPx: 4, glowPx: 3 },
  rare: { wanderRadiusPct: 3.6, runCycleSec: 2.4, bobAmpPx: 5, glowPx: 6 },
  'super-rare': {
    wanderRadiusPct: 4.2,
    runCycleSec: 2.1,
    bobAmpPx: 5,
    glowPx: 10,
    showTrail: true,
  },
  epic: {
    wanderRadiusPct: 5,
    runCycleSec: 1.9,
    bobAmpPx: 6,
    glowPx: 14,
    showTrail: true,
    showParticles: true,
  },
  legendary: {
    wanderRadiusPct: 5.8,
    runCycleSec: 1.6,
    idleCycleSec: 1.6,
    kickHoldMs: 500,
    bobAmpPx: 7,
    glowPx: 18,
    showTrail: true,
    showParticles: true,
  },
  mythic: {
    wanderRadiusPct: 6.5,
    runCycleSec: 1.4,
    idleCycleSec: 1.3,
    kickHoldMs: 540,
    bobAmpPx: 8,
    glowPx: 22,
    showTrail: true,
    showParticles: true,
  },
};

const KIT_BY_POSITION: Record<
  string,
  { shirt: string; shirtShadow: string; shirtHighlight: string; shorts: string; socks: string }
> = {
  GK: {
    shirt: '#f2c94c',
    shirtShadow: '#c9a020',
    shirtHighlight: '#ffe28a',
    shorts: '#1b1f33',
    socks: '#f2c94c',
  },
  DEF: {
    shirt: '#3b82c4',
    shirtShadow: '#245a8f',
    shirtHighlight: '#6eb0e8',
    shorts: '#16324f',
    socks: '#3b82c4',
  },
  LAT: {
    shirt: '#0e7490',
    shirtShadow: '#155e75',
    shirtHighlight: '#67e8f9',
    shorts: '#082f49',
    socks: '#0e7490',
  },
  MID: {
    shirt: '#2f9e6a',
    shirtShadow: '#1c6b46',
    shirtHighlight: '#5dcea0',
    shorts: '#143d2a',
    socks: '#2f9e6a',
  },
  FW: {
    shirt: '#d64545',
    shirtShadow: '#9a2828',
    shirtHighlight: '#f07878',
    shorts: '#3d1515',
    socks: '#d64545',
  },
  GOL: {
    shirt: '#f2c94c',
    shirtShadow: '#c9a020',
    shirtHighlight: '#ffe28a',
    shorts: '#1b1f33',
    socks: '#f2c94c',
  },
  ZAG: {
    shirt: '#3b82c4',
    shirtShadow: '#245a8f',
    shirtHighlight: '#6eb0e8',
    shorts: '#16324f',
    socks: '#3b82c4',
  },
  MEI: {
    shirt: '#2f9e6a',
    shirtShadow: '#1c6b46',
    shirtHighlight: '#5dcea0',
    shorts: '#143d2a',
    socks: '#2f9e6a',
  },
  ATA: {
    shirt: '#d64545',
    shirtShadow: '#9a2828',
    shirtHighlight: '#f07878',
    shorts: '#3d1515',
    socks: '#d64545',
  },
};

const SKIN_TONES = [
  { skin: '#f0c8a0', shadow: '#d4a07a', highlight: '#ffe0c0' },
  { skin: '#e0a878', shadow: '#c48858', highlight: '#f0c498' },
  { skin: '#c88858', shadow: '#a06840', highlight: '#e0a878' },
  { skin: '#8d5a3c', shadow: '#6a3e28', highlight: '#b07850' },
  { skin: '#5c3a28', shadow: '#3e2418', highlight: '#7a5040' },
] as const;

const HAIR_STYLES: Record<BonecoRarity, { hair: string; highlight: string }> = {
  common: { hair: '#3a2412', highlight: '#5a3a1e' },
  uncommon: { hair: '#1a2e14', highlight: '#3a5a28' },
  rare: { hair: '#1e140c', highlight: '#3a2818' },
  'super-rare': { hair: '#2a1848', highlight: '#4a2a78' },
  epic: { hair: '#4a3010', highlight: '#7a5020' },
  legendary: { hair: '#1a0808', highlight: '#4a1818' },
  mythic: { hair: '#063828', highlight: '#0a5840' },
};

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

export function normalizeBonecoRarity(raw: string | undefined | null): BonecoRarity {
  if (raw && raw in RARITY_HEX) return raw as BonecoRarity;
  return 'common';
}

export function getBonecoMotion(rarity: string | undefined | null): BonecoMotionParams {
  const key = normalizeBonecoRarity(rarity);
  return { ...DEFAULT_MOTION, ...MOTION_BY_RARITY[key] };
}

export function getBonecoKit(
  rarity: string | undefined | null,
  position: BonecoPosition,
  seed = 'x',
): BonecoKitColors {
  const key = normalizeBonecoRarity(rarity);
  const glow = RARITY_HEX[key];
  const pos = KIT_BY_POSITION[position] ?? KIT_BY_POSITION.MID!;
  const tone = SKIN_TONES[hashSeed(seed) % SKIN_TONES.length]!;
  const hair = HAIR_STYLES[key];
  const premiumBoots = key === 'legendary' || key === 'mythic' || key === 'epic';

  return {
    skin: tone.skin,
    skinShadow: tone.shadow,
    skinHighlight: tone.highlight,
    hair: hair.hair,
    hairHighlight: hair.highlight,
    shirt: pos.shirt,
    shirtShadow: pos.shirtShadow,
    shirtHighlight: pos.shirtHighlight,
    shorts: pos.shorts,
    socks: pos.socks,
    boots: premiumBoots ? '#0d0d0d' : '#1a1a1a',
    outline: '#0a0a12',
    accent: glow,
    glow,
    gloves: '#f4efe4',
  };
}

export function rarityGlowCss(rarity: string | undefined | null): string {
  return RARITY_HEX[normalizeBonecoRarity(rarity)];
}
