import type { FastifyInstance } from 'fastify';
import { playerStakeParamsSchema } from '@mll/shared';
import { PlayerStakeService } from './player-stake.service.js';

export async function registerPlayerStakeRoutes(app: FastifyInstance) {
  const service = new PlayerStakeService(app.prisma);

  app.post(
    '/players/:kind/:playerId/stake',
    { schema: { tags: ['players'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const { kind, playerId } = playerStakeParamsSchema.parse(request.params);
      return service.stake(request.user.id, kind, playerId);
    },
  );

  app.post(
    '/players/:kind/:playerId/unstake',
    { schema: { tags: ['players'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const { kind, playerId } = playerStakeParamsSchema.parse(request.params);
      return service.unstake(request.user.id, kind, playerId);
    },
  );
}
