import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PvpService } from './pvp.service.js';

const createSchema = z.object({
  stakeGmt: z.coerce.number().positive().max(1_000_000),
});

const idSchema = z.object({
  id: z.string().uuid(),
});

export async function registerPvpRoutes(app: FastifyInstance) {
  const service = new PvpService(app.prisma);

  app.get(
    '/board',
    { schema: { tags: ['pvp'], security: [{ bearerAuth: [] }] } },
    async (request) => service.board(request.user.id),
  );

  app.post(
    '/listings',
    { schema: { tags: ['pvp'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const body = createSchema.parse(request.body);
      return { listing: await service.createListing(request.user.id, body.stakeGmt) };
    },
  );

  app.post(
    '/listings/:id/cancel',
    { schema: { tags: ['pvp'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const params = idSchema.parse(request.params);
      return { listing: await service.cancelListing(request.user.id, params.id) };
    },
  );

  app.post(
    '/listings/:id/accept',
    { schema: { tags: ['pvp'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const params = idSchema.parse(request.params);
      return { listing: await service.acceptListing(request.user.id, params.id) };
    },
  );
}
