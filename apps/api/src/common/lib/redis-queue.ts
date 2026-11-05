import type Redis from 'ioredis';
import type { QueueOptions } from 'bullmq';

/** Normalize ioredis instance for BullMQ (avoids duplicate ioredis type paths in monorepo). */
export function asBullMqConnection(redis: Redis): QueueOptions['connection'] {
  return redis as unknown as QueueOptions['connection'];
}
