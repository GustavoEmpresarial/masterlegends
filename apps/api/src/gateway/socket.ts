import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { FastifyInstance } from 'fastify';
import { config } from '../config/env.js';
import { attachSocketAuth } from './auth.middleware.js';
import { setupPresence } from './presence.js';
import { setupPvpRoom } from './rooms/pvp.room.js';
import { setupSocketRateLimit } from './rateLimit.js';
import { logger } from '../common/lib/logger.js';
import { NotificationsService } from '../modules/notifications/notifications.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
    notifications: NotificationsService;
  }
}

export async function setupSocketGateway(app: FastifyInstance): Promise<Server> {
  const io = new Server(app.server, {
    path: config.SOCKET_PATH,
    cors: {
      origin: config.CORS_ORIGINS,
      credentials: true,
    },
  });

  // duplicate() abre conexão própria automaticamente — não chamar connect() de novo
  const pubClient = app.redis.duplicate();
  const subClient = app.redis.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  attachSocketAuth(app, io);
  setupSocketRateLimit(io, app.redis);
  setupPresence(io, app.redis);
  setupPvpRoom(io, app.redis, app.prisma);

  io.on('connection', (socket) => {
    const userId = (socket.data?.user as { id?: string } | undefined)?.id;
    logger.info({ event: 'ws.connected', userId, socketId: socket.id }, 'Socket connected');
    socket.on('disconnect', (reason) => {
      logger.info({ event: 'ws.disconnected', userId, reason }, 'Socket disconnected');
    });
  });

  app.decorate('io', io);
  app.decorate('notifications', new NotificationsService(io));

  app.addHook('onClose', async () => {
    await io.close();
  });

  return io;
}
