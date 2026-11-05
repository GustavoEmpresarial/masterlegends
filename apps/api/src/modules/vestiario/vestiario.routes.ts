import type { FastifyInstance } from 'fastify';
import { lineupPatchSchema } from '@mll/shared';
import { ClubRepository } from '../club/club.repository.js';
import { StadiumRepository } from '../stadium/stadium.repository.js';
import { StadiumPlayerService } from '../stadium/stadium-player.service.js';
import { StaminaService } from '../stamina/stamina.service.js';
import { VestiarioTemplateRepository } from './vestiario-template.repository.js';
import { VestiarioService } from './vestiario.service.js';
import { PassRepository, PassService } from '../pass/pass.service.js';

export async function registerVestiarioRoutes(app: FastifyInstance) {
  const clubRepo = new ClubRepository(app.prisma);
  const stadiumRepo = new StadiumRepository(app.prisma);
  const vestiarioTemplateRepo = new VestiarioTemplateRepository(app.prisma);
  const staminaService = new StaminaService(app.prisma, clubRepo, stadiumRepo, vestiarioTemplateRepo);
  const service = new VestiarioService(
    app.prisma,
    clubRepo,
    new StadiumPlayerService(stadiumRepo, clubRepo, vestiarioTemplateRepo),
    staminaService,
  );
  const passService = new PassService(new PassRepository(app.prisma), app.prisma);

  app.get(
    '/',
    { schema: { tags: ['vestiario'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getView(request.user.id),
  );

  app.post(
    '/rest',
    { schema: { tags: ['vestiario'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const result = await service.claimDailyRest(request.user.id);
      app.notifications.emitCtStaminaUpdate(request.user.id, { reason: 'daily-rest' });
      app.notifications.emitCtInvalidate(request.user.id, 'daily-rest');
      return result;
    },
  );

  app.put(
    '/lineup',
    { schema: { tags: ['vestiario'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const body = lineupPatchSchema.parse(request.body);
      const result = await service.saveLineup(request.user.id, body.assignments);
      const { bumpQuestTrigger } = await import('../events/events.routes.js');
      await Promise.all([
        passService.getMissionProgressService().incrementEvent(request.user.id, 'lineup_save', 1),
        bumpQuestTrigger(app, request.user.id, 'lineup_save', 1),
      ]);
      app.notifications.emitCtRosterUpdate(request.user.id, 'lineup', {
        assignments: body.assignments.length,
      });
      app.notifications.emitCtInvalidate(request.user.id, 'lineup-save');
      return result;
    },
  );
}
