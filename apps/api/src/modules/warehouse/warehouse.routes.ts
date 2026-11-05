import type { FastifyInstance } from 'fastify';
import { WarehouseService } from './warehouse.service.js';
import { authGuard } from '../../common/guards/auth.guard.js';

export async function registerWarehouseRoutes(app: FastifyInstance) {
  const warehouse = new WarehouseService(app.prisma);

  app.get(
    '/',
    {
      preHandler: [authGuard],
      schema: { tags: ['warehouse'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      return warehouse.listUserItems(request.user.id);
    },
  );

  app.get(
    '/pending',
    {
      preHandler: [authGuard],
      schema: { tags: ['warehouse'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      return warehouse.listPendingItems(request.user.id);
    },
  );

  app.get(
    '/:itemId',
    {
      preHandler: [authGuard],
      schema: { tags: ['warehouse'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { itemId } = request.params as { itemId: string };
      return warehouse.getItem(request.user.id, itemId);
    },
  );

  app.post(
    '/:itemId/claim',
    {
      preHandler: [authGuard],
      schema: { tags: ['warehouse'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { itemId } = request.params as { itemId: string };
      return warehouse.claimItem(request.user.id, itemId);
    },
  );
}
