import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { ErrorCode, serializeError } from '@mll/shared';
import type { AuthUser } from '../common/guards/auth.guard.js';

function getAuthUserId(request: FastifyRequest): string | undefined {
  const user = (request as FastifyRequest & { user?: AuthUser }).user;
  return user?.id;
}

export default fp(async function rateLimitPlugin(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    redis: app.redis,
    keyGenerator: (request: FastifyRequest) => {
      return getAuthUserId(request) ?? request.ip;
    },
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'retry-after': true,
    },
    errorResponseBuilder: (request: FastifyRequest, context: { after: string }) => ({
      ...serializeError(
        getAuthUserId(request) ? ErrorCode.RATE_LIMITED_USER : ErrorCode.RATE_LIMITED,
        429,
        { retryAfter: context.after },
      ),
    }),
  });
});
