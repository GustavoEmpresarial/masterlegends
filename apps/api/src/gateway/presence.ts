import type { Server } from 'socket.io';
import type Redis from 'ioredis';
import {
  SocketEvent,
  STADIUM_WATCH_TTL_SEC,
  stadiumWatchKey,
  stadiumWatchSocketsKey,
} from '@mll/shared';
import type { AuthedSocket } from './types.js';

const TTL_SEC = 60;
const onlineKey = (userId: string) => `online:user:${userId}`;
const ONLINE_SET = 'online:users';

async function markStadiumWatching(redis: Redis, userId: string, socketId: string) {
  const socketsKey = stadiumWatchSocketsKey(userId);
  await redis
    .multi()
    .sadd(socketsKey, socketId)
    .expire(socketsKey, STADIUM_WATCH_TTL_SEC)
    .set(stadiumWatchKey(userId), '1', 'EX', STADIUM_WATCH_TTL_SEC)
    .exec();
}

async function markStadiumUnwatching(redis: Redis, userId: string, socketId: string) {
  const socketsKey = stadiumWatchSocketsKey(userId);
  await redis.srem(socketsKey, socketId);
  const left = await redis.scard(socketsKey);
  if (left === 0) {
    await redis.del(stadiumWatchKey(userId), socketsKey);
  }
}

export function setupPresence(io: Server, redis: Redis) {
  async function markOnline(userId: string) {
    await redis
      .multi()
      .sadd(ONLINE_SET, userId)
      .set(onlineKey(userId), '1', 'EX', TTL_SEC)
      .exec();
    io.to('presence').emit(SocketEvent.PRESENCE_UPDATE, { userId, online: true });
  }

  async function markOffline(userId: string) {
    await redis
      .multi()
      .srem(ONLINE_SET, userId)
      .del(onlineKey(userId))
      .exec();
    io.to('presence').emit(SocketEvent.PRESENCE_UPDATE, { userId, online: false });
  }

  io.on('connection', async (socket) => {
    const s = socket as AuthedSocket;
    const userId = s.data.user.id;

    await s.join([`user:${userId}`, 'presence']);
    await markOnline(userId);

    s.on(SocketEvent.PRESENCE_HEARTBEAT, async () => {
      await redis.set(onlineKey(userId), '1', 'EX', TTL_SEC);
    });

    s.on(SocketEvent.STADIUM_WATCH, async () => {
      await markStadiumWatching(redis, userId, s.id);
    });

    s.on(SocketEvent.STADIUM_UNWATCH, async () => {
      await markStadiumUnwatching(redis, userId, s.id);
    });

    s.on('disconnect', async () => {
      await markStadiumUnwatching(redis, userId, s.id);
      // Only mark offline if no other sockets remain for this user.
      const sockets = await io.in(`user:${userId}`).fetchSockets();
      if (sockets.length === 0) {
        await markOffline(userId);
      }
    });
  });
}

export async function isOnline(redis: Redis, userId: string): Promise<boolean> {
  return (await redis.exists(onlineKey(userId))) === 1;
}
