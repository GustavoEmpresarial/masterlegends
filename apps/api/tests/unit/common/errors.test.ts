import { describe, it, expect } from 'vitest';
import { AppError, ErrorCode, serializeError } from '../../../src/common/lib/errors.js';

describe('serializeError', () => {
  it('produces canonical shape', () => {
    expect(serializeError(ErrorCode.AUTH_INVALID_CREDENTIALS, 401)).toEqual({
      error: { code: 'AUTH_INVALID_CREDENTIALS', statusCode: 401 },
    });
  });
});

describe('AppError', () => {
  it('carries code and status', () => {
    const err = new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    expect(err.code).toBe('CLUB_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });
});
