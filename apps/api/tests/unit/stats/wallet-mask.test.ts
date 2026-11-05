import { describe, expect, it } from 'vitest';
import { maskWalletAddress } from '../../../src/modules/stats/wallet-mask.js';

describe('maskWalletAddress', () => {
  it('masks a standard EVM address', () => {
    expect(maskWalletAddress('0xAbCdEf1234567890AbCdEf1234567890AbCdEf12')).toBe('0xAbCd...Ef12');
  });

  it('returns null for missing or short values', () => {
    expect(maskWalletAddress(null)).toBeNull();
    expect(maskWalletAddress('')).toBeNull();
    expect(maskWalletAddress('0x1234')).toBeNull();
  });
});
