export const BONECO_POSITIONS = ['GK', 'DEF', 'LAT', 'MID', 'FW'] as const;
export const BONECO_KITS = ['verde', 'azul', 'vermelho', 'amarelo', 'preto', 'branco'] as const;
export const BONECO_TRIMS = ['branco', 'preto', 'dourado', 'vermelho'] as const;
export const BONECO_POSES = ['parado', 'correndo', 'chute', 'defesa', 'comemoracao'] as const;

export type BonecoPosition = (typeof BONECO_POSITIONS)[number];
export type BonecoKit = (typeof BONECO_KITS)[number];
export type BonecoTrim = (typeof BONECO_TRIMS)[number];
export type BonecoPose = (typeof BONECO_POSES)[number];

export const BONECO_RARITIES = ['common', 'uncommon', 'rare', 'super-rare', 'epic', 'legendary'] as const;
export type BonecoRarity = (typeof BONECO_RARITIES)[number];

/** The four numbers printed on the card art. The card data uses these same values. */
export interface BonecoCardStats {
  strength: number;
  speed: number;
  stamina: number;
  performance: number;
}

export interface BonecoSpec {
  position: BonecoPosition;
  rarity?: BonecoRarity;
  kit?: BonecoKit;
  trim?: BonecoTrim;
  pose?: BonecoPose;
  note?: string;
  playerName?: string | null;
  stats?: BonecoCardStats;
}

/** Cores oficiais do card. A moldura e o badge seguem a raridade do jogador. */
const RARITY_CARD: Record<BonecoRarity, { badge: string; color: string; hex: string }> = {
  common: { badge: 'COMMON', color: 'steel gray', hex: '#9898a8' },
  uncommon: { badge: 'UNCOMMON', color: 'green', hex: '#65a30d' },
  rare: { badge: 'RARE', color: 'blue', hex: '#5888d8' },
  'super-rare': { badge: 'SUPER RARE', color: 'purple', hex: '#9070c8' },
  epic: { badge: 'EPIC', color: 'gold', hex: '#e0b028' },
  legendary: { badge: 'LEGENDARY', color: 'crimson red', hex: '#c04848' },
};

export function bonecoRarityFromIndex(index: number): BonecoRarity {
  return BONECO_RARITIES[index] ?? 'common';
}

export function sanitizeBonecoNote(raw: string): string {
  const cleaned = Array.from(raw, (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : char;
  }).join('');
  return cleaned.replace(/\s+/g, ' ').trim().slice(0, 400);
}

const KIT_NAME: Record<BonecoKit, string> = {
  verde: 'green',
  azul: 'royal blue',
  vermelho: 'red',
  amarelo: 'yellow',
  preto: 'black',
  branco: 'white',
};

const TRIM_NAME: Record<BonecoTrim, string> = {
  branco: 'white',
  preto: 'black',
  dourado: 'gold',
  vermelho: 'red',
};

const POSE_NAME: Record<BonecoPose, string> = {
  parado: 'standing idle, feet apart, facing the camera',
  correndo: 'running toward the right, one leg forward',
  chute: 'kicking a ball with the right foot, ball near the foot',
  defesa: 'goalkeeper dive to the side, gloves up',
  comemoracao: 'celebrating with one arm raised',
};

const POSITION_NAME: Record<BonecoPosition, string> = {
  GK: 'goalkeeper with gloves',
  DEF: 'centre-back',
  LAT: 'full-back',
  MID: 'midfielder',
  FW: 'striker',
};

/** O arquivo inteiro é o card, no layout da referência. */
export function buildBonecoPrompt(spec: BonecoSpec): string {
  const rarity = RARITY_CARD[spec.rarity ?? 'common'];
  const otherBadges = Object.values(RARITY_CARD)
    .filter((item) => item.badge !== rarity.badge)
    .map((item) => item.badge)
    .join(', ');
  return [
    'SYSTEM: Card rarity colors are fixed. Use only this player rarity. Never borrow another rarity color or badge word.',
    'Rarity color table: COMMON steel gray #9898a8, UNCOMMON green #65a30d, RARE blue #5888d8, SUPER RARE purple #9070c8, EPIC gold #e0b028, LEGENDARY crimson red #c04848.',
    `This player is ${rarity.badge}. The metal frame, rivets, inner glow and the top-right badge must be ${rarity.color} ${rarity.hex}.`,
    `The top-right badge text must be exactly ${rarity.badge}. Do not write ${otherBadges} on the badge.`,
    'The owner description may change hair, clothes, boots and pose only. It must not change the frame color or the rarity word.',
    'Vertical football trading card, aspect ratio 3:4. The colored frame touches the left, right, top and bottom edges. No black bars, no side padding, no empty margin.',
    `Match this layout: thick ${rarity.color} metal frame with rivets and a ${rarity.color} inner glow, goal net along the top edge.`,
    'Top-left shield badge with a crown, the letters MLL, a soccer ball and three stars. Keep that shield, but do not let it replace the rarity color of the frame.',
    `Top-right ${rarity.color} badge with a crown and the word ${rarity.badge}.`,
    'Center: one 16-bit pixel-art football player, full body, thick black outline, flat colors, not photorealistic.',
    'Behind the player: green pitch, red-and-white stadium seats, white goal, floodlights, orange sunset sky.',
    spec.stats
      ? `Bottom blue panel keeps the original card design: the icons, the pixel labels STRENGTH, SPEED, STAMINA, PERFORMANCE, and the meter tracks already in the layout. Do not redraw that panel, do not cover it, do not add a new box. Fill each existing meter track and place its number inside that track, on the right. Top-left STRENGTH ${spec.stats.strength}. Top-right SPEED ${spec.stats.speed}. Bottom-left STAMINA ${spec.stats.stamina}. Bottom-right PERFORMANCE ${spec.stats.performance}.`
      : 'Bottom blue panel with exactly these labels: STRENGTH, SPEED, STAMINA, PERFORMANCE.',
    'Bottom banner in white block letters: MASTER LEGEND LEAGUE, with a soccer ball on each side.',
    `Player role: ${POSITION_NAME[spec.position]}.`,
    spec.pose ? `Pose: ${POSE_NAME[spec.pose]}.` : 'Pose follows the owner description. If none is given, standing idle, feet apart, facing the camera.',
    spec.kit
      ? `Jersey and shorts: solid ${KIT_NAME[spec.kit]}${spec.trim ? `, with ${TRIM_NAME[spec.trim]} collar, sleeve cuffs and sock bands` : ''}. The kit color is the shirt only, not the card frame.`
      : 'Clothes, hair and boots come only from the owner description. Those colors are the player, not the card frame.',
    spec.playerName ? `This card belongs to the player named ${spec.playerName}.` : '',
    spec.note
      ? `CUSTOMIZATION, apply only to the player's body, hair, clothes, boots and pose: ${spec.note}.`
      : '',
    `SYSTEM after customization: keep the metal frame, inner glow and top-right badge as ${rarity.badge}, ${rarity.color} ${rarity.hex}. Personalizing the player never changes the rarity color or the badge word.`,
  ].filter(Boolean).join(' ');
}

/** Resposta do Image API (`POST /images`): `data[].b64_json`. */
export function extractBonecoImageBase64(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const b64 = (item as { b64_json?: unknown }).b64_json;
    if (typeof b64 === 'string' && b64.length > 0) return b64;
    const url = (item as { url?: unknown }).url;
    if (typeof url === 'string' && url.startsWith('data:image/')) {
      const comma = url.indexOf(',');
      if (comma >= 0 && url.length > comma + 1) return url.slice(comma + 1);
    }
  }
  return null;
}

export function extractBonecoImageDataUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const message = (payload as { choices?: Array<{ message?: unknown }> }).choices?.[0]?.message;
  if (!message || typeof message !== 'object') return null;

  const images = (message as { images?: unknown }).images;
  const fromImages = firstDataUrl(images);
  if (fromImages) return fromImages;

  const content = (message as { content?: unknown }).content;
  return firstDataUrl(content);
}

function firstDataUrl(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const part of value) {
    if (!part || typeof part !== 'object') continue;
    const url = (part as { image_url?: { url?: unknown } }).image_url?.url;
    if (typeof url === 'string' && url.startsWith('data:image/')) return url;
  }
  return null;
}

export function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
  return Buffer.from(b64, 'base64');
}
