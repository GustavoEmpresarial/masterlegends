import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TelegramService } from './telegram.service.js';
import { config } from '../../config/env.js';
import { AppError, ErrorCode } from '../../common/lib/errors.js';

const prefsSchema = z.object({
  notifyEnabled: z.boolean(),
});

function verifyWebhookSecret(request: {
  headers: Record<string, string | string[] | undefined>;
  query: unknown;
}): boolean {
  const expected = config.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;
  const header = request.headers['x-telegram-bot-api-secret-token'];
  if (typeof header === 'string' && header === expected) return true;
  const q = request.query as { secret?: string };
  return typeof q.secret === 'string' && q.secret === expected;
}

export async function registerTelegramRoutes(app: FastifyInstance) {
  const telegram = new TelegramService(app.prisma, app.redis, app.redisQueue);

  app.get(
    '/status',
    { schema: { tags: ['telegram'], security: [{ bearerAuth: [] }] } },
    async (request) => telegram.getStatus(request.user.id),
  );

  app.post(
    '/link',
    { schema: { tags: ['telegram'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      if (!telegram.enabled) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 503, { reason: 'telegram_disabled' });
      }
      return telegram.createLinkCode(request.user.id);
    },
  );

  app.delete(
    '/unlink',
    { schema: { tags: ['telegram'], security: [{ bearerAuth: [] }] } },
    async (request) => telegram.unlink(request.user.id),
  );

  app.patch(
    '/prefs',
    { schema: { tags: ['telegram'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const body = prefsSchema.parse(request.body);
      return telegram.setNotifyEnabled(request.user.id, body.notifyEnabled);
    },
  );

  app.post(
    '/webhook',
    {
      config: { public: true },
      schema: { tags: ['telegram'] },
    },
    async (request, reply) => {
      if (!verifyWebhookSecret(request)) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      if (!telegram.enabled) {
        return { ok: true };
      }

      await telegram.handleUpdate(
        request.body as {
          message?: { text?: string; chat?: { id?: number | string } };
        },
      );
      return { ok: true };
    },
  );
}
