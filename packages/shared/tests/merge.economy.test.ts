import { describe, expect, it } from 'vitest';
import { MERGE_LADDER, MERGE_LEGENDARY_VALUE_GMT, mergeFeeUsdcForInputRarityIndex, mergeStepForInputRarity } from '@mll/shared';

describe('merge economy', () => {
  it('funde cada raridade na seguinte, inclusive incomum', () => {
    expect(MERGE_LADDER.map((step) => [step.inputRarity, step.outputRarity, step.feeGmt])).toEqual([
      [0, 1, 0.25],
      [1, 2, 0.5],
      [2, 3, 1],
      [3, 4, 2],
      [4, 5, 3],
    ]);
    expect(mergeStepForInputRarity(0)).toMatchObject({ outputRarity: 1, feeGmt: 0.25 });
    expect(mergeStepForInputRarity(1)).toMatchObject({ outputRarity: 2, feeGmt: 0.5 });
    expect(mergeStepForInputRarity(5)).toBeNull();
    expect(mergeFeeUsdcForInputRarityIndex(4)).toBe(3);
    expect(MERGE_LEGENDARY_VALUE_GMT).toBe(3125);
  });
});