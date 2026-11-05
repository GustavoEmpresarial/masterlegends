import type Redis from 'ioredis';
import { config } from '../../config/env.js';

const DAY_TTL_SEC = 2 * 24 * 3600;

export function marketingDayStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function dayKey(day = marketingDayStamp()): string {
  return `email:marketing:day:${day}`;
}

function reservedKey(day = marketingDayStamp()): string {
  return `email:marketing:reserved:${day}`;
}

export type MarketingQuota = {
  dailyLimit: number;
  perMinute: number;
  sentToday: number;
  reservedToday: number;
  remainingToday: number;
};

export async function getMarketingQuota(redis: Redis): Promise<MarketingQuota> {
  const day = marketingDayStamp();
  const [sentRaw, reservedRaw] = await redis.mget(dayKey(day), reservedKey(day));
  const sentToday = Math.max(0, Number(sentRaw) || 0);
  const reservedToday = Math.max(0, Number(reservedRaw) || 0);
  const dailyLimit = config.EMAIL_MARKETING_DAILY_LIMIT;
  const remainingToday = Math.max(0, dailyLimit - sentToday - reservedToday);
  return {
    dailyLimit,
    perMinute: config.EMAIL_MARKETING_PER_MINUTE,
    sentToday,
    reservedToday,
    remainingToday,
  };
}

const RESERVE_LUA = `
local sent = tonumber(redis.call('GET', KEYS[1]) or '0')
local reserved = tonumber(redis.call('GET', KEYS[2]) or '0')
local limit = tonumber(ARGV[1])
local n = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local remaining = limit - sent - reserved
if n > remaining then
  return {0, remaining, sent, reserved}
end
redis.call('INCRBY', KEYS[2], n)
redis.call('EXPIRE', KEYS[2], ttl)
return {1, remaining - n, sent, reserved + n}
`;

/** Atomically reserve N marketing slots for today. */
export async function tryReserveMarketing(
  redis: Redis,
  n: number,
): Promise<{ ok: boolean; remainingToday: number; sentToday: number; reservedToday: number }> {
  const day = marketingDayStamp();
  const result = (await redis.eval(
    RESERVE_LUA,
    2,
    dayKey(day),
    reservedKey(day),
    String(config.EMAIL_MARKETING_DAILY_LIMIT),
    String(n),
    String(DAY_TTL_SEC),
  )) as [number, number, number, number];

  return {
    ok: Number(result[0]) === 1,
    remainingToday: Number(result[1]) || 0,
    sentToday: Number(result[2]) || 0,
    reservedToday: Number(result[3]) || 0,
  };
}

export async function releaseMarketingReservation(redis: Redis, n = 1): Promise<void> {
  if (n <= 0) return;
  const key = reservedKey();
  const next = await redis.decrby(key, n);
  if (next < 0) await redis.set(key, '0', 'EX', DAY_TTL_SEC);
  else await redis.expire(key, DAY_TTL_SEC);
}
