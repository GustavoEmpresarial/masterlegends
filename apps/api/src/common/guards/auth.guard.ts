import { FastifyRequest, FastifyReply } from 'fastify';
import { ErrorCode, serializeError } from '@mll/shared';
import { authorizePlayer } from '../lib/prisma-context.js';

export interface AuthUser {
  id: string;
  email?: string;
  wallet?: string;
  banned?: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
  }
}

export interface AccessTokenClaims {
  sub: string;
  email?: string;
  wallet?: string;
  type?: 'access' | 'refresh' | 'admin' | 'admin-refresh';
}

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send(serializeError(ErrorCode.AUTH_UNAUTHORIZED, 401));
  }

  const token = authHeader.substring(7).trim();

  try {
    const decoded = request.server.jwt.verify<AccessTokenClaims>(token);

    if (decoded.type !== 'access') {
      return reply.status(401).send(serializeError(ErrorCode.AUTH_INVALID_TOKEN_TYPE, 401));
    }

    request.user = {
      id: decoded.sub,
      email: decoded.email,
      wallet: decoded.wallet,
    };

    // Libera queries Prisma no scope player antes do ban check (/api/* inicia como player)
    authorizePlayer(decoded.sub);

    const dbUser = await request.server.prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { bannedAt: true, banReason: true, lockedUntil: true },
    });
    if (dbUser?.bannedAt) {
      return reply.status(403).send(
        serializeError(ErrorCode.USER_BANNED, 403, { reason: dbUser.banReason }),
      );
    }
    if (
      dbUser?.lockedUntil &&
      dbUser.lockedUntil > new Date() &&
      dbUser.lockedUntil.getTime() >= new Date('2099-01-01T00:00:00.000Z').getTime()
    ) {
      return reply.status(403).send(serializeError(ErrorCode.USER_DISABLED, 403));
    }
  } catch {
    return reply.status(401).send(serializeError(ErrorCode.AUTH_UNAUTHORIZED, 401));
  }
}
