import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { config } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Fast commands: auth tokens, rate-limit, Socket.IO adapter, PvP queue. */
    redis: Redis;
    /** BullMQ producers — requires maxRetriesPerRequest: null. */
    redisQueue: Redis;
  }
}

export default fp(async function redisPlugin(app: FastifyInstance) {
  const redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  const redisQueue = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  app.decorate('redis', redis);
  app.decorate('redisQueue', redisQueue);

  app.addHook('onClose', async () => {
    await Promise.all([redis.quit(), redisQueue.quit()]);
  });
});
