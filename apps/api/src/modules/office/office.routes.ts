import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OfficeService } from './office.service.js';
import { AfflictionService } from '../afflictions/affliction.service.js';

const kindSchema = z.object({ kind: z.enum(['treasurer', 'coach']) });

export async function registerOfficeRoutes(app: FastifyInstance) {
  const service = new OfficeService(app.prisma);
  const afflictions = new AfflictionService(app.prisma);

  app.get(
    '/',
    { schema: { tags: ['office'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getStatus(request.user.id),
  );

  app.get(
    '/coach-fees',
    { schema: { tags: ['office'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getCoachFeeReport(request.user.id),
  );

  app.post(
    '/:kind/hire',
    { schema: { tags: ['office'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const { kind } = kindSchema.parse(request.params);
      return service.hire(request.user.id, kind);
    },
  );

  app.get(
    '/afflictions/active',
    { schema: { tags: ['office'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const items = await afflictions.listActiveForUser(request.user.id);
      return {
        items: items.map((a) => ({
          id: a.id,
          targetKind: a.targetKind,
          code: a.code,
          note: a.note,
          expiresAt: a.expiresAt.toISOString(),
        })),
      };
    },
  );

  app.post(
    '/:kind/fire',
    { schema: { tags: ['office'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const { kind } = kindSchema.parse(request.params);
      return service.fire(request.user.id, kind);
    },
  );
}
