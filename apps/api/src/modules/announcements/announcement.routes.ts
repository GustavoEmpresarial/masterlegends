import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AnnouncementService } from './announcement.service.js';

const dismissParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function registerAnnouncementRoutes(app: FastifyInstance) {
  const service = new AnnouncementService(app.prisma);

  app.get(
    '/active',
    { schema: { tags: ['announcements'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const announcement = await service.getActiveForUser(request.user.id);
      return { announcement };
    },
  );

  app.post(
    '/:id/dismiss',
    { schema: { tags: ['announcements'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const { id } = dismissParamsSchema.parse(request.params);
      return service.dismiss(request.user.id, id);
    },
  );
}
