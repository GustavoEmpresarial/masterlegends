/** Attributes that change how much a player contributes in his position. */

export const PLAYER_ATTRIBUTE_KEYS = [
  'ataque',
  'defesa',
  'passe',
  'velocidade',
  'finalizacao',
  'forca',
  'resistencia',
  'tecnica',
  'inteligencia',
  'goleiro',
] as const;

export type PlayerAttributeKey = (typeof PLAYER_ATTRIBUTE_KEYS)[number];
export type PlayerAttributes = Record<PlayerAttributeKey, number>;
export type FieldRole = 'GK' | 'DEF' | 'LAT' | 'MID' | 'FW';

/** Weights sum to 1. The first attribute is the one that defines the role. */
export const POSITION_ATTRIBUTE_WEIGHTS: Record<FieldRole, Partial<Record<PlayerAttributeKey, number>>> = {
  GK: { goleiro: 0.4, defesa: 0.25, passe: 0.2, inteligencia: 0.15 },
  DEF: { defesa: 0.4, forca: 0.25, resistencia: 0.2, inteligencia: 0.15 },
  LAT: { velocidade: 0.4, defesa: 0.25, passe: 0.2, resistencia: 0.15 },
  MID: { passe: 0.4, tecnica: 0.25, inteligencia: 0.2, velocidade: 0.15 },
  FW: { finalizacao: 0.4, ataque: 0.25, velocidade: 0.2, tecnica: 0.15 },
};

const BANDS: readonly (readonly [number, number])[] = [
  [1, 10],
  [2, 20],
  [4, 40],
  [80, 160],
  [320, 640],
  [1280, 2560],
];

const POSITION_BY_INDEX: readonly FieldRole[] = ['GK', 'DEF', 'MID', 'FW', 'LAT'];

export function overwallBand(rarity: number): readonly [number, number] {
  if (rarity <= 0) return BANDS[0]!;
  if (rarity >= BANDS.length) return BANDS[BANDS.length - 1]!;
  return BANDS[rarity]!;
}

export function fieldRole(position: number | string | null | undefined): FieldRole {
  if (typeof position === 'number') return POSITION_BY_INDEX[position] ?? 'FW';
  const raw = String(position ?? '').toUpperCase();
  if (raw === 'GOL' || raw === 'GK') return 'GK';
  if (raw === 'ZAG' || raw === 'DEF') return 'DEF';
  if (raw === 'LAT') return 'LAT';
  if (raw === 'MEI' || raw === 'MID') return 'MID';
  if (raw === 'ATA' || raw === 'FW') return 'FW';
  return 'FW';
}

/** Unsigned 32-bit FNV-1a. The SQL backfill uses the same steps. */
export function fnv1a32(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function attributeInBand(seed: string, rarity: number): number {
  const [lo, hi] = overwallBand(rarity);
  const span = hi - lo + 1;
  return lo + (fnv1a32(seed) % span);
}

export function rollPlayerAttributes(
  id: string,
  rarity: number,
  position: number | string,
): PlayerAttributes {
  const role = fieldRole(position);
  const attributes = {} as PlayerAttributes;
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    attributes[key] = key === 'goleiro' && role !== 'GK' ? 0 : attributeInBand(`${id}:${key}`, rarity);
  }
  return attributes;
}

export function readPlayerAttributes(
  value: unknown,
  id: string,
  rarity: number,
  position: number | string,
): PlayerAttributes {
  if (value && typeof value === 'object') {
    const raw = value as Record<string, unknown>;
    const parsed = {} as PlayerAttributes;
    let complete = true;
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      const n = Number(raw[key]);
      if (!Number.isFinite(n)) {
        complete = false;
        break;
      }
      parsed[key] = Math.round(n);
    }
    if (complete) return parsed;
  }
  return rollPlayerAttributes(id, rarity, position);
}

/** The attribute that defines the role. Training raises this one. */
export const ROLE_MAIN_ATTRIBUTE: Record<FieldRole, PlayerAttributeKey> = {
  GK: 'goleiro',
  DEF: 'defesa',
  LAT: 'velocidade',
  MID: 'passe',
  FW: 'finalizacao',
};

/** Points added per finished training. Level 1 is +1, 4 is +2, 7 is +3, 10 is +4. */
export function trainingEvolutionStep(ctLvl: number): number {
  const level = Number.isFinite(ctLvl) ? Math.max(1, Math.floor(ctLvl)) : 1;
  return 1 + Math.floor((level - 1) / 3);
}

export function evolveMainAttribute(
  attributes: PlayerAttributes,
  position: number | string,
  rarity: number,
  ctLvl: number,
): { key: PlayerAttributeKey; before: number; after: number } {
  const key = ROLE_MAIN_ATTRIBUTE[fieldRole(position)];
  const [, hi] = overwallBand(rarity);
  const before = attributes[key];
  const after = Math.min(hi, before + trainingEvolutionStep(ctLvl));
  return { key, before, after };
}

/** Weighted attribute score for the player's position. A mix of band values stays in that band. */
export function positionPower(attributes: PlayerAttributes, position: number | string): number {
  const weights = POSITION_ATTRIBUTE_WEIGHTS[fieldRole(position)];
  let sum = 0;
  for (const [key, weight] of Object.entries(weights)) {
    sum += (attributes[key as PlayerAttributeKey] ?? 0) * (weight ?? 0);
  }
  return Math.max(1, Math.round(sum));
}
