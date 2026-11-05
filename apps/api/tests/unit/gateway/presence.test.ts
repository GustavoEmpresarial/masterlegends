import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Redis from 'ioredis-mock';
import { isOnline } from '../../../src/gateway/presence.js';

describe('presence isOnline', () => {
  let redis: InstanceType<typeof Redis>;

  beforeEach(() => {
    redis = new Redis();
  });

  afterEach(async () => {
    await redis.quit();
  });

  it('returns false when user not marked online', async () => {
    expect(await isOnline(redis as any, 'u1')).toBe(false);
  });

  it('returns true when TTL key exists', async () => {
    await redis.set('online:user:u1', '1', 'EX', 60);
    expect(await isOnline(redis as any, 'u1')).toBe(true);
  });
});
