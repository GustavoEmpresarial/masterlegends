import { describe, expect, it } from 'vitest';
import { isBelowMinimum, quantizeMoney, splitFeeBps, splitFeeRate, splitPool } from '../src/economy/money.js';

describe('money precision', () => {
  it('cuts USDT to 6 places and GMT to 8, downward', () => {
    expect(quantizeMoney('usdt', '1.2399999')).toBe('1.239999');
    expect(quantizeMoney('gmt', '1.239999999')).toBe('1.23999999');
    expect(quantizeMoney('usdc', 0.0000009)).toBe('0.000000');
  });

  it('treats a quantized zero as below the minimum', () => {
    expect(isBelowMinimum('usdt', quantizeMoney('usdt', '0.0000004'))).toBe(true);
    expect(isBelowMinimum('gmt', quantizeMoney('gmt', '0.000000001'))).toBe(true);
    expect(isBelowMinimum('usdt', quantizeMoney('usdt', '0.000001'))).toBe(false);
  });

  it('keeps fee plus net equal to the quantized gross', () => {
    const split = splitFeeRate('usdt', '10', '0.05');
    expect(split.fee).toBe('0.500000');
    expect(split.net).toBe('9.500000');
    expect(splitFeeBps('gmt', '10', 1000)).toEqual({
      gross: '10.00000000',
      fee: '1.00000000',
      net: '9.00000000',
    });
  });

  it('leaves the undistributed remainder as residual and drops dust shares', () => {
    const pool = splitPool('usdt', '0.1', [
      { key: 'a', weight: 1 },
      { key: 'b', weight: 1 },
      { key: 'c', weight: 1 },
    ]);
    expect(pool.shares.map((row) => row.amount)).toEqual(['0.033333', '0.033333', '0.033333']);
    expect(pool.residual).toBe('0.000001');

    const dust = splitPool('usdt', '0.000001', [
      { key: 'a', weight: 1 },
      { key: 'b', weight: 1 },
      { key: 'c', weight: 1 },
    ]);
    expect(dust.shares).toEqual([]);
    expect(dust.residual).toBe('0.000001');
  });
});
