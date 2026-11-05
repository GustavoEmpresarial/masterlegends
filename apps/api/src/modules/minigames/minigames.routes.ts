import type { FastifyInstance } from 'fastify';
import { ClubRepository } from '../club/club.repository.js';
import { StadiumRepository } from '../stadium/stadium.repository.js';
import { StaminaService } from '../stamina/stamina.service.js';
import { VestiarioTemplateRepository } from '../vestiario/vestiario-template.repository.js';
import { MinigamesService } from './minigames.service.js';
import { PassRepository, PassService } from '../pass/pass.service.js';

export async function registerMinigamesRoutes(app: FastifyInstance) {
  const clubRepo = new ClubRepository(app.prisma);
  const staminaService = new StaminaService(
    app.prisma,
    clubRepo,
    new StadiumRepository(app.prisma),
    new VestiarioTemplateRepository(app.prisma),
  );
  const service = new MinigamesService(app.prisma, clubRepo, staminaService, app.redis);
  const passService = new PassService(new PassRepository(app.prisma), app.prisma);

  app.get(
    '/',
    { schema: { tags: ['minigames'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getCatalog(request.user.id),
  );

  app.post(
    '/recovery_penalty/start',
    { schema: { tags: ['minigames'], security: [{ bearerAuth: [] }] } },
    async (request) => service.startPenalty(request.user.id, request.body),
  );

  app.post(
    '/recovery_penalty/shoot',
    { schema: { tags: ['minigames'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const result = await service.shootPenalty(request.user.id, request.body);
      if (result.scored) {
        void passService.getMissionProgressService().incrementEvent(request.user.id, 'penalty_goals', 1);
      }
      return result;
    },
  );

  app.post(
    '/:id/play',
    { schema: { tags: ['minigames'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.play(request.user.id, id, request.body);
    },
  );
}
