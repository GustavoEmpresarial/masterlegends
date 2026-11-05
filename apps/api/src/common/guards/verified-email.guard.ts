import type { FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCode, serializeError } from '@mll/shared';

export async function verifiedEmailGuard(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user?.id) {
    return reply.status(401).send(serializeError(ErrorCode.AUTH_UNAUTHORIZED, 401));
  }

  const user = await request.server.prisma.user.findUnique({
    where: { id: request.user.id },
    select: { emailVerifiedAt: true },
  });

  if (!user?.emailVerifiedAt) {
    return reply.status(403).send(serializeError(ErrorCode.AUTH_EMAIL_NOT_VERIFIED, 403));
  }
}
