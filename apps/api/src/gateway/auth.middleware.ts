import type { Server, Socket } from 'socket.io';
import type { FastifyInstance } from 'fastify';

export function attachSocketAuth(app: FastifyInstance, io: Server) {
  io.use((socket: Socket, next) => {
    try {
      const raw =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7)
          : undefined);

      if (!raw) {
        return next(new Error('WS_UNAUTHORIZED'));
      }

      const decoded = app.jwt.verify<{ sub: string; email?: string; type?: string }>(raw);
      if (decoded.type !== 'access') {
        return next(new Error('WS_UNAUTHORIZED'));
      }

      socket.data.user = { id: decoded.sub, email: decoded.email };
      next();
    } catch {
      next(new Error('WS_UNAUTHORIZED'));
    }
  });
}
