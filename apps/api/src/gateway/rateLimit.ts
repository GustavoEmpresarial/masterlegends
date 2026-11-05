import type { Server } from 'socket.io';
import type Redis from 'ioredis';
import type { AuthedSocket } from './types.js';

const WINDOW_SEC = 1;
const MAX_EVENTS = 30;

export function setupSocketRateLimit(io: Server, redis: Redis) {
  io.use((socket, next) => {
    const s = socket as AuthedSocket;
    s.use(async (_packet, next) => {
      const key = `ws:rl:${s.data.user.id}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, WINDOW_SEC);
      }
      if (count > MAX_EVENTS) {
        return next(new Error('WS_RATE_LIMITED'));
      }
      next();
    });
    next();
  });
}
