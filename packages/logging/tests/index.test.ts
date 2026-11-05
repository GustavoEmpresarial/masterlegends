import { describe, it, expect } from 'vitest';
import { createLogger } from '../src/index.js';

describe('createLogger', () => {
  it('creates logger without mongo when disabled', () => {
    const logger = createLogger({
      service: 'api',
      level: 'silent',
      mongo: { enabled: false },
    });
    expect(logger).toBeTruthy();
    logger.info('test');
  });
});
