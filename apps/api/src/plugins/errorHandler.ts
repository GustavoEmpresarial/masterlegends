import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { ErrorCode, serializeError } from '@mll/shared';
import { AppError } from '../common/lib/errors.js';
import { PrismaContextError } from '../common/lib/prisma-context.js';

export default fp(async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send(serializeError(error.code, error.statusCode, error.details));
    }

    if (error instanceof ZodError) {
      return reply
        .status(400)
        .send(
          serializeError(ErrorCode.VALIDATION_ERROR, 400, { issues: error.flatten().fieldErrors }),
        );
    }

    if (error instanceof PrismaContextError) {
      request.log.error({ err: error }, 'Prisma context missing for request');
      return reply.status(500).send(serializeError(ErrorCode.UNKNOWN, 500));
    }

    if ((error as { code?: string }).code === 'FST_CSRF_INVALID_TOKEN') {
      return reply.status(403).send(serializeError(ErrorCode.AUTH_CSRF_INVALID, 403));
    }

    const wrapped = (error as { error?: { statusCode?: number; code?: string; details?: Record<string, unknown> } })
      .error;
    if (wrapped?.statusCode === 429 && wrapped.code) {
      return reply.status(429).send({ error: wrapped });
    }

    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.status(429).send(serializeError(ErrorCode.RATE_LIMITED_USER, 429));
    }

    const statusCode =
      (error as { statusCode?: number }).statusCode && (error as { statusCode?: number }).statusCode! >= 400
        ? (error as { statusCode?: number }).statusCode!
        : 500;

    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Unhandled server error');
    }

    return reply.status(statusCode).send(serializeError(ErrorCode.UNKNOWN, statusCode));
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send(serializeError(ErrorCode.UNKNOWN, 404));
  });
});
