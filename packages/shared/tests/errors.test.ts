import { describe, it, expect } from 'vitest';
import { ErrorCode, serializeError } from '../src/errors.js';

describe('serializeError', () => {
  it('serializes canonical shape', () => {
    expect(serializeError(ErrorCode.AUTH_INVALID_CREDENTIALS, 401)).toEqual({
      error: { code: 'AUTH_INVALID_CREDENTIALS', statusCode: 401 },
    });
  });

  it('includes optional details', () => {
    const out = serializeError(ErrorCode.INSUFFICIENT_MGT, 400, { required: 10 });
    expect(out.error.details).toEqual({ required: 10 });
  });
});

describe('ErrorCode', () => {
  it('exposes stable auth codes', () => {
    expect(ErrorCode.AUTH_REFRESH_REUSED).toBe('AUTH_REFRESH_REUSED');
    expect(ErrorCode.AUTH_CSRF_INVALID).toBe('AUTH_CSRF_INVALID');
  });
});
