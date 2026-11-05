import type { FastifyInstance } from 'fastify';
import {
  AdminPermission,
  ErrorCode,
  type AdminWarehouseGrantInputDTO,
} from '@mll/shared';
import { AppError } from '../../common/lib/errors.js';
import {
  adminGuard,
  requireAdminPermission,
} from '../../common/guards/admin.guard.js';
import { WarehouseService } from '../warehouse/warehouse.service.js';

export async function registerAdminWarehouseRoutes(app: FastifyInstance) {
  const warehouse = new WarehouseService(app.prisma);

  app.get(
    '/warehouse/user/:userId',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin', 'warehouse'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { userId } = request.params as { userId: string };
      return warehouse.listAdminItems(userId);
    },
  );

  app.post(
    '/warehouse/grant',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ITEMS)],
      schema: { tags: ['admin', 'warehouse'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = request.body as AdminWarehouseGrantInputDTO;

      if (!body.userId || !body.itemType || !body.name) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
          reason: 'userId, itemType, and name are required',
        });
      }

      return warehouse.grantAdminItem(body);
    },
  );

  app.delete(
    '/warehouse/:itemId/user/:userId',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ITEMS)],
      schema: { tags: ['admin', 'warehouse'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { itemId, userId } = request.params as { itemId: string; userId: string };
      await warehouse.removeItem(itemId, userId);
      return { ok: true };
    },
  );
}
