import { FastifyInstance } from 'fastify';
import { claimRewardParamsSchema } from '@mll/shared';
import { PassRepository, PassService } from './pass.service.js';

function assertPassOpen(_seasonId?: number) {
  return;
}

export async function registerPassRoutes(app: FastifyInstance) {
  const service = new PassService(new PassRepository(app.prisma), app.prisma);

  app.get(
    '/progress',
    { schema: { tags: ['pass'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getProgress(request.user.id),
  );

  app.post(
    '/claim/:level',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: { tags: ['pass'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const params = claimRewardParamsSchema.parse(request.params);
      const body = (request.body ?? {}) as { seasonId?: number; track?: string };
      const seasonId = Number(body.seasonId);
      assertPassOpen(Number.isInteger(seasonId) ? seasonId : undefined);
      const track = body.track === 'gold' ? 'gold' : 'free';
      return service.claim(request.user.id, params.level, Number.isInteger(seasonId) ? seasonId : undefined, track);
    },
  );

  app.post(
    '/premium',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: { tags: ['pass'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = (request.body ?? {}) as { seasonId?: number };
      const seasonId = Number(body.seasonId);
      assertPassOpen(Number.isInteger(seasonId) ? seasonId : undefined);
      return service.buyPremium(request.user.id, Number.isInteger(seasonId) ? seasonId : undefined);
    },
  );

  app.post(
    '/events/market-visit',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: { tags: ['pass'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      await service.getMissionProgressService().incrementEvent(request.user.id, 'market_visit', 1);
      const { bumpQuestTrigger } = await import('../events/events.routes.js');
      bumpQuestTrigger(app, request.user.id, 'market_visit', 1);
      return { ok: true };
    },
  );
}
