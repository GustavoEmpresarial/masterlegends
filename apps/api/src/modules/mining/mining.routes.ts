import { FastifyInstance } from 'fastify';
import { MiningService } from './mining.service.js';

export async function registerMiningRoutes(app: FastifyInstance) {
  const service = new MiningService(app.prisma, app.redis);

  app.get(
    '/me',
    { schema: { tags: ['mining'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getSummary(request.user.id),
  );

  app.get(
    '/blocks',
    { schema: { tags: ['mining'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const { limit } = request.query as { limit?: string };
      return { blocks: await service.listBlocks(Number(limit) || 20) };
    },
  );

  app.get(
    '/history',
    { schema: { tags: ['mining'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const { limit } = request.query as { limit?: string };
      return { rewards: await service.listHistory(request.user.id, Number(limit) || 50) };
    },
  );
}
