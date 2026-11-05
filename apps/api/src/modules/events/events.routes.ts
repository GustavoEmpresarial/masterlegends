import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EventsService } from './events.service.js';

const claimParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function registerEventsRoutes(app: FastifyInstance) {
  const service = new EventsService(app.prisma);

  app.get(
    '/',
    { schema: { tags: ['events'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getPlayerBoard(request.user.id),
  );

  app.post(
    '/quests/:id/claim',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: { tags: ['events'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = claimParamsSchema.parse(request.params);
      return service.claims.claim(request.user.id, id, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
    },
  );
}

/** Shared helper for other modules to bump quest progress. */
export function bumpQuestTrigger(
  app: FastifyInstance,
  userId: string,
  trigger: string,
  amount = 1,
): Promise<void> {
  return new EventsService(app.prisma).progress.incrementTrigger(userId, trigger, amount);
}
