import { FastifyInstance } from 'fastify';
import { ReferralsRepository } from './referrals.repository.js';
import { ReferralsService } from './referrals.service.js';

export async function registerReferralsRoutes(app: FastifyInstance) {
  const service = new ReferralsService(new ReferralsRepository(app.prisma));

  app.get(
    '/stats',
    { schema: { tags: ['referrals'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getStats(request.user.id),
  );

  app.get(
    '/details',
    { schema: { tags: ['referrals'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getDetails(request.user.id),
  );
}
