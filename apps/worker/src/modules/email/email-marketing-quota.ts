import type Redis from 'ioredis';
import { UnrecoverableError } from 'bullmq';
import { config } from '../../config/env.js';

const DAY_TTL_SEC = 2 * 24 * 3600;
const MIN_TTL_SEC = 120;

function dayStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function minStamp(d = new Date()): string {
  // YYYYMMDDHHmm (UTC)
  return d.toISOString().slice(0, 16).replace(/[-:T]/g, '');
}

function dayKey(day = dayStamp()): string {
  return `email:marketing:day:${day}`;
}

function reservedKey(day = dayStamp()): string {
  return `email:marketing:reserved:${day}`;
}

function minKey(min = minStamp()): string {
  return `email:marketing:min:${min}`;
}

export async function releaseMarketingReservation(redis: Redis, n = 1): Promise<void> {
  if (n <= 0) return;
  const key = reservedKey();
  const next = await redis.decrby(key, n);
  if (next < 0) await redis.set(key, '0', 'EX', DAY_TTL_SEC);
  else await redis.expire(key, DAY_TTL_SEC);
}

/**
 * Gate marketing send: per-minute (retryable) then daily (unrecoverable).
 * Call before sendMail. On success call recordMarketingSent.
 */
export async function assertMarketingSendAllowed(redis: Redis): Promise<void> {
  const dailyLimit = config.EMAIL_MARKETING_DAILY_LIMIT;
  const perMinute = config.EMAIL_MARKETING_PER_MINUTE;
  const day = dayStamp();
  const min = minStamp();

  const minuteCount = Number(await redis.get(minKey(min))) || 0;
  if (minuteCount >= perMinute) {
    throw new Error('marketing_rate_limited');
  }

  const sentToday = Number(await redis.get(dayKey(day))) || 0;
  if (sentToday >= dailyLimit) {
    throw new UnrecoverableError('marketing_daily_quota_exhausted');
  }
}

export async function recordMarketingSent(redis: Redis): Promise<void> {
  const day = dayStamp();
  const min = minStamp();
  const pipe = redis.pipeline();
  pipe.incr(dayKey(day));
  pipe.expire(dayKey(day), DAY_TTL_SEC);
  pipe.decr(reservedKey(day));
  pipe.expire(reservedKey(day), DAY_TTL_SEC);
  pipe.incr(minKey(min));
  pipe.expire(minKey(min), MIN_TTL_SEC);
  const results = await pipe.exec();
  // Clamp reserved >= 0 if race drove it negative
  const reservedIdx = 2;
  const reservedResult = results?.[reservedIdx];
  if (reservedResult && !reservedResult[0]) {
    const val = Number(reservedResult[1]);
    if (val < 0) await redis.set(reservedKey(day), '0', 'EX', DAY_TTL_SEC);
  }
}
