import type { FastifyInstance } from 'fastify';
import { AdminPermission, ErrorCode } from '@mll/shared';
import { AppError } from '../../common/lib/errors.js';
import {
  adminGuard,
  requireAdminPermission,
} from '../../common/guards/admin.guard.js';
import { OfferwallService } from '../offerwall/offerwall.service.js';

export async function registerAdminOfferwallRoutes(app: FastifyInstance) {
  const offerwall = new OfferwallService(app.prisma);

  app.get(
    '/offerwall/rewards',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_REPORTS)],
      schema: { tags: ['admin', 'offerwall'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const q = request.query as { userId?: string; provider?: string; limit?: string };
      return offerwall.listAdminRewards({
        userId: q.userId,
        provider: q.provider,
        limit: q.limit ? Number(q.limit) : undefined,
      });
    },
  );

  app.post(
    '/offerwall/rewards/:transactionId/reverse',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin', 'offerwall'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { transactionId } = request.params as { transactionId: string };
      return offerwall.reverseReward(transactionId);
    },
  );
}
