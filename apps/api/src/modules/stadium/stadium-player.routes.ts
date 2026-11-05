import type { FastifyInstance } from 'fastify';
import { lineupPatchSchema, stadiumLicenseTemplateIdParamsSchema } from '@mll/shared';
import { z } from 'zod';
import { listStaminaHistory } from '../stamina/stamina-ledger.js';
import { ClubRepository } from '../club/club.repository.js';
import { StaminaService } from '../stamina/stamina.service.js';
import { StadiumRepository } from './stadium.repository.js';
import { VestiarioTemplateRepository } from '../vestiario/vestiario-template.repository.js';
import { StadiumPlayerService } from './stadium-player.service.js';
import { StadiumLicenseService } from './stadium-license.service.js';
import { PassRepository, PassService } from '../pass/pass.service.js';

export async function registerStadiumPlayerRoutes(app: FastifyInstance) {
  const clubRepo = new ClubRepository(app.prisma);
  const stadiumRepo = new StadiumRepository(app.prisma);
  const vestiarioTemplateRepo = new VestiarioTemplateRepository(app.prisma);
  const staminaService = new StaminaService(app.prisma, clubRepo, stadiumRepo, vestiarioTemplateRepo);
  const service = new StadiumPlayerService(
    stadiumRepo,
    clubRepo,
    vestiarioTemplateRepo,
    app.prisma,
    staminaService,
  );
  const licenses = new StadiumLicenseService(app.prisma);
  const passService = new PassService(new PassRepository(app.prisma), app.prisma);

  app.get(
    '/stamina-history',
    { schema: { tags: ['stadium'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const query = z
        .object({
          playerId: z.string().min(1).max(64),
          kind: z.enum(['base', 'nft']),
        })
        .parse(request.query);
      const entries = await listStaminaHistory(app.prisma, request.user.id, query.kind, query.playerId);
      return { entries };
    },
  );

  app.get(
    '/view',
    { schema: { tags: ['stadium'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getView(request.user.id),
  );

  app.get(
    '/licenses',
    { schema: { tags: ['stadium'], security: [{ bearerAuth: [] }] } },
    async (request) => licenses.getCatalog(request.user.id),
  );

  app.post(
    '/licenses/:templateId/buy',
    { schema: { tags: ['stadium'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const { templateId } = stadiumLicenseTemplateIdParamsSchema.parse(request.params);
      return licenses.buy(request.user.id, templateId);
    },
  );

  app.post(
    '/licenses/:templateId/sign',
    { schema: { tags: ['stadium'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const { templateId } = stadiumLicenseTemplateIdParamsSchema.parse(request.params);
      return licenses.sign(request.user.id, templateId);
    },
  );

  app.post(
    '/licenses/:templateId/activate',
    { schema: { tags: ['stadium'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const { templateId } = stadiumLicenseTemplateIdParamsSchema.parse(request.params);
      return licenses.activate(request.user.id, templateId);
    },
  );

  app.put(
    '/lineup',
    { schema: { tags: ['stadium'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const body = lineupPatchSchema.parse(request.body);
      const result = await service.saveLineup(request.user.id, body.assignments);
      const { bumpQuestTrigger } = await import('../events/events.routes.js');
      await Promise.all([
        passService.getMissionProgressService().incrementEvent(request.user.id, 'lineup_save', 1),
        bumpQuestTrigger(app, request.user.id, 'lineup_save', 1),
      ]);
      return result;
    },
  );
}
