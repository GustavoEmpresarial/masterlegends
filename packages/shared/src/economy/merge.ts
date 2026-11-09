/** Base players required per fusion (same input rarity). */
export const MERGE_INPUT_COUNT = 5;

/**
 * Fusion ladder. Five of a rarity become one of the next.
 * Fees are flat GMT charges. Legendary 3,125 is the career-cost floor, not a fee.
 */
export const MERGE_LADDER = [
  { inputRarity: 0, outputRarity: 1, feeGmt: 0.25 },
  { inputRarity: 1, outputRarity: 2, feeGmt: 0.5 },
  { inputRarity: 2, outputRarity: 3, feeGmt: 1 },
  { inputRarity: 3, outputRarity: 4, feeGmt: 2 },
  { inputRarity: 4, outputRarity: 5, feeGmt: 3 },
] as const;

/** Shown on the rules table and used as the career-cost floor of a fused legendary. */
export const MERGE_LEGENDARY_VALUE_GMT = 3125;

export function mergeStepForInputRarity(inputRarity: number) {
  return MERGE_LADDER.find((step) => step.inputRarity === inputRarity) ?? null;
}

/** GMT fee for a fusible input rarity. Legendary returns 0. */
export function mergeFeeUsdcForInputRarityIndex(inputRarity: number): number {
  return mergeStepForInputRarity(inputRarity)?.feeGmt ?? 0;
}
