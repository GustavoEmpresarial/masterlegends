import { describe, it, expect } from 'vitest';
import { normalizeWalletConnectError } from '../../../src/lib/wallet/connect';

describe('normalizeWalletConnectError', () => {
  it('maps a viem user-rejection error (numeric code) to WALLET_USER_REJECTED', () => {
    const viemError = Object.assign(new Error('User rejected the request.'), { code: 4001 });
    expect((normalizeWalletConnectError(viemError) as Error & { code: string }).code).toBe(
      'WALLET_USER_REJECTED',
    );
  });

  it('maps a nested cause.code (wrapped connector error) to WALLET_USER_REJECTED', () => {
    const wrapped = Object.assign(new Error('Connector error'), {
      cause: { code: 4001 },
    });
    expect((normalizeWalletConnectError(wrapped) as Error & { code: string }).code).toBe(
      'WALLET_USER_REJECTED',
    );
  });

  it('maps -32002 to WALLET_REQUEST_PENDING', () => {
    const pending = Object.assign(new Error('Request already pending'), { code: -32002 });
    expect((normalizeWalletConnectError(pending) as Error & { code: string }).code).toBe(
      'WALLET_REQUEST_PENDING',
    );
  });

  it('falls back to WALLET_CONNECT_FAILED for unrecognized errors', () => {
    const unknown = new Error('boom');
    expect((normalizeWalletConnectError(unknown) as Error & { code: string }).code).toBe(
      'WALLET_CONNECT_FAILED',
    );
  });

  it('passes through errors that already carry one of our string WALLET_ codes', () => {
    const alreadyOurs = Object.assign(new Error('WALLET_NO_ACCOUNT'), { code: 'WALLET_NO_ACCOUNT' });
    expect(normalizeWalletConnectError(alreadyOurs)).toBe(alreadyOurs);
  });
});
