import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import jwtPlugin from '@fastify/jwt';
import Redis from 'ioredis-mock';
import { RefreshTokenService } from '../../../src/modules/auth/tokens/refresh-token.service.js';
import { ErrorCode } from '../../../src/common/lib/errors.js';

const SECRET = 'test-jwt-secret-with-at-least-32-characters!!';

describe('RefreshTokenService', () => {
  let app: ReturnType<typeof Fastify>;
  let redis: InstanceType<typeof Redis>;
  let service: RefreshTokenService;

  beforeEach(async () => {
    app = Fastify();
    await app.register(jwtPlugin, { secret: SECRET });
    redis = new Redis();
    service = new RefreshTokenService(app, redis as any);
  });

  afterEach(async () => {
    await app.close();
    await redis.quit();
  });

  it('issues and rotates refresh token', async () => {
    const first = await service.issue('user-1');
    const { result } = await service.rotate(first.token);
    expect(result.jti).not.toBe(first.jti);
    expect(result.familyId).toBe(first.familyId);
  });

  it('detects refresh reuse', async () => {
    vi.useFakeTimers();
    try {
      const first = await service.issue('user-1');
      await service.rotate(first.token);
      vi.advanceTimersByTime(16_000);
      await expect(service.rotate(first.token)).rejects.toMatchObject({
        code: ErrorCode.AUTH_REFRESH_REUSED,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('revokes all families for user', async () => {
    const first = await service.issue('user-1');
    await service.revokeAllForUser('user-1');
    await expect(service.rotate(first.token)).rejects.toMatchObject({
      code: ErrorCode.AUTH_REFRESH_REUSED,
    });
  });
});
