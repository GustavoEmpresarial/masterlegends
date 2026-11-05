import type { FastifyInstance } from 'fastify';
import { bumpQuestTrigger } from '../events/events.routes.js';
import { CheckInService } from './checkin.service.js';

export async function registerCheckInRoutes(app: FastifyInstance) {
  const service = new CheckInService(app.prisma);

  app.get(
    '/',
    { schema: { tags: ['checkin'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getStatus(request.user.id),
  );

  app.post(
    '/claim',
    { schema: { tags: ['checkin'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const result = await service.claim(request.user.id);
      bumpQuestTrigger(app, request.user.id, 'checkin_claim', 1);
      return result;
    },
  );
}
