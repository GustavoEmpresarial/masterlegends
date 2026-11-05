import { describe, expect, it } from 'vitest';
import { usdtToSatspayUnits } from '../../../src/modules/wallet/satspay-client.js';

describe('usdtToSatspayUnits', () => {
  it('uses 8 decimal ledger units', () => {
    expect(usdtToSatspayUnits('1')).toBe('100000000');
    expect(usdtToSatspayUnits('10')).toBe('1000000000');
    expect(usdtToSatspayUnits('9.5')).toBe('950000000');
    expect(usdtToSatspayUnits('0.000001')).toBe('100');
  });
});
