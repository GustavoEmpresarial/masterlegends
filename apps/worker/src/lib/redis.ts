import Redis from 'ioredis';
import { config } from '../config/env.js';

/** BullMQ requires maxRetriesPerRequest: null for blocking commands. */
export function createQueueRedis(): Redis {
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}
