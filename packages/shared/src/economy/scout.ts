/**
 * Preço da carta no mercado da liga, em GMT.
 * O mint do olheiro é sempre 0.25 GMT (`SCOUT_COST_GMT`), qualquer raridade.
 * O stake trava a metade deste preço.
 */
export const RARITY_MINT_GMT: Record<ScoutRarityId, number> = {
  common: 0.25,
  uncommon: 1.25,
  rare: 6.35,
  'super-rare': 31.25,
  epic: 156.25,
  legendary: 750,
};

/** GMT de cada carta no olheiro. Não muda com a raridade sorteada. */
export const SCOUT_COST_GMT = 0.25;

/** @deprecated use SCOUT_COST_GMT */
export const SCOUT_COST_USDC = SCOUT_COST_GMT;

/** @deprecated a tabela oficial não é mais uma potência única. */
export const CAREER_COST_RARITY_FACTOR = 5;

/** Preço de marketplace da raridade. Não é o custo do mint. */
export function mintGmtForRarityIndex(rarityIndex: number): number {
  const index = Math.floor(Number(rarityIndex));
  const id = SCOUT_RARITY_ORDER[index];
  if (id) return RARITY_MINT_GMT[id];
  if (Number.isFinite(index) && index >= SCOUT_RARITY_ORDER.length) return RARITY_MINT_GMT.legendary;
  return RARITY_MINT_GMT.common;
}

/**
 * Custo de carreira de um mint: o GMT pago na carta, mais uma taxa extra.
 * O preço de marketplace não entra aqui.
 */
export function careerCostBasisForRarity(
  _rarityIndex: number,
  baseUnitCost: number,
  extraFee = 0,
): number {
  const unit = Number.isFinite(baseUnitCost) ? Math.max(0, baseUnitCost) : 0;
  const fee = Number.isFinite(extraFee) ? Math.max(0, extraFee) : 0;
  return parseFloat((unit + fee).toFixed(6));
}

export const SCOUT_MAX_PER_TX = 10;

/** Chance that a rolled template position is replaced by LAT. */
export const SCOUT_LATERAL_CHANCE = 0.2;

/** Scout pool. Mythic is not a tier; it shares the legendary band. */
export const SCOUT_RARITY_ORDER = ['common', 'uncommon', 'rare', 'super-rare', 'epic', 'legendary'] as const;
export type ScoutRarityId = (typeof SCOUT_RARITY_ORDER)[number];

/**
 * Drop weights. They do not have to sum to 1: the roll and the rules API divide by the total.
 * These integers are the published chances: 50 / 30 / 10 / 6 / 3 / 1.
 */
export const SCOUT_RARITY_WEIGHTS: Record<ScoutRarityId, number> = {
  common: 50,
  uncommon: 30,
  rare: 10,
  'super-rare': 6,
  epic: 3,
  legendary: 1,
};

export type ScoutRarityWeights = Record<ScoutRarityId, number>;

/** Configured weights, or the code defaults when the stored JSON is missing or invalid. */
export function parseScoutRarityWeights(raw: unknown): ScoutRarityWeights {
  if (!raw || typeof raw !== 'object') return { ...SCOUT_RARITY_WEIGHTS };
  const src = raw as Record<string, unknown>;
  const next = {} as ScoutRarityWeights;
  for (const id of SCOUT_RARITY_ORDER) {
    const weight = Number(src[id]);
    if (!Number.isFinite(weight) || weight < 0) return { ...SCOUT_RARITY_WEIGHTS };
    next[id] = weight;
  }
  const total = SCOUT_RARITY_ORDER.reduce((sum, id) => sum + next[id], 0);
  if (total <= 0) return { ...SCOUT_RARITY_WEIGHTS };
  return next;
}

/**
 * Inclusive OVERWALL band per rarity. Same intervals for scout and merge.
 * Each band starts above the previous maximum, so a higher rarity never rolls a lower one.
 */
export const SCOUT_OVERWALL_RANGES: Record<ScoutRarityId, readonly [number, number]> = {
  common: [1, 10],
  uncommon: [11, 20],
  rare: [21, 40],
  'super-rare': [80, 160],
  epic: [320, 640],
  legendary: [1280, 2560],
};

/** Stamina drained per hour on the pitch — higher rarity = higher cost. */
export const STAMINA_DRAIN_PER_HOUR: Record<ScoutRarityId, number> = {
  common: 8,
  uncommon: 9,
  rare: 10,
  'super-rare': 12,
  epic: 16,
  legendary: 20,
};

export interface ScoutRarityRuleDTO {
  id: ScoutRarityId;
  chancePct: number;
  overwallMin: number;
  overwallMax: number;
  staminaDrainPerHour: number;
  /** GMT do mint, já com desconto. Igual para todas as raridades. */
  mintCostGmt: number;
}

export interface ScoutRulesDTO {
  /** Base GMT cost per mint (before discount). */
  costUsdc: number;
  /** Effective GMT cost per mint after global discount. */
  effectiveCostUsdc: number;
  /** Global discount fraction 0–1. */
  discountPct: number;
  maxPerTx: number;
  rarities: ScoutRarityRuleDTO[];
}

export function buildScoutRules(
  discountPct = 0,
  weights?: ScoutRarityWeights | null,
  baseCost = SCOUT_COST_GMT,
): ScoutRulesDTO {
  const clamped = Math.min(1, Math.max(0, discountPct));
  const base = Number.isFinite(baseCost) && baseCost > 0 ? baseCost : SCOUT_COST_GMT;
  const table = weights ? parseScoutRarityWeights(weights) : SCOUT_RARITY_WEIGHTS;
  const weightTotal = SCOUT_RARITY_ORDER.reduce((sum, id) => sum + table[id], 0);
  return {
    costUsdc: base,
    effectiveCostUsdc: parseFloat((base * (1 - clamped)).toFixed(4)),
    discountPct: clamped,
    maxPerTx: SCOUT_MAX_PER_TX,
    rarities: SCOUT_RARITY_ORDER.map((id) => ({
      id,
      chancePct: (table[id] / weightTotal) * 100,
      overwallMin: SCOUT_OVERWALL_RANGES[id][0],
      overwallMax: SCOUT_OVERWALL_RANGES[id][1],
      staminaDrainPerHour: STAMINA_DRAIN_PER_HOUR[id],
      mintCostGmt: parseFloat((base * (1 - clamped)).toFixed(4)),
    })),
  };
}

/** Farm stamina drain for a rarity index. Above the scout pool uses the legendary rate. */
export function staminaDrainPerHourForIndex(rarityIndex: number): number {
  const id = SCOUT_RARITY_ORDER[rarityIndex];
  if (id) return STAMINA_DRAIN_PER_HOUR[id];
  if (rarityIndex >= SCOUT_RARITY_ORDER.length) return STAMINA_DRAIN_PER_HOUR.legendary;
  return STAMINA_DRAIN_PER_HOUR.common;
}

/** Roll a scout rarity index. Weights are divided by their sum. */
export function rollScoutRarityIndex(rand: () => number, weights?: ScoutRarityWeights | null): number {
  const table = weights ? parseScoutRarityWeights(weights) : SCOUT_RARITY_WEIGHTS;
  const weightList = SCOUT_RARITY_ORDER.map((id) => table[id]);
  const total = weightList.reduce((sum, w) => sum + w, 0);
  let roll = rand() * total;
  for (let i = 0; i < weightList.length; i++) {
    roll -= weightList[i]!;
    if (roll < 0) return i;
  }
  return weightList.length - 1;
}

/** Uniform overwall in the documented range for the rarity index. */
export function rollScoutOverwall(rarityIndex: number, rand: () => number): number {
  const id = SCOUT_RARITY_ORDER[rarityIndex];
  if (!id) {
    throw new Error('Invalid scout rarity index');
  }
  const [min, max] = SCOUT_OVERWALL_RANGES[id];
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function isOverwallInScoutRange(rarityIndex: number, overwall: number): boolean {
  const id = SCOUT_RARITY_ORDER[rarityIndex];
  if (!id) return false;
  const [min, max] = SCOUT_OVERWALL_RANGES[id];
  return overwall >= min && overwall <= max;
}
