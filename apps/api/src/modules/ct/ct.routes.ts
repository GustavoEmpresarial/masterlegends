import type { FastifyInstance } from 'fastify';
import { ClubRepository } from '../club/club.repository.js';
import { StadiumRepository } from '../stadium/stadium.repository.js';
import { StaminaService } from '../stamina/stamina.service.js';
import { VestiarioTemplateRepository } from '../vestiario/vestiario-template.repository.js';
import { CtService } from './ct.service.js';

export async function registerCtRoutes(app: FastifyInstance) {
  const clubRepo = new ClubRepository(app.prisma);
  const staminaService = new StaminaService(
    app.prisma,
    clubRepo,
    new StadiumRepository(app.prisma),
    new VestiarioTemplateRepository(app.prisma),
  );
  const service = new CtService(app.prisma, clubRepo, staminaService);

  app.get(
    '/',
    { schema: { tags: ['ct'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getView(request.user.id),
  );

  app.get(
    '/records',
    { schema: { tags: ['ct'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const query = request.query as { playerId?: string; kind?: string };
      let player: { kind: 'base' | 'nft'; playerId: string } | undefined;
      if (query.playerId && (query.kind === 'base' || query.kind === 'nft')) {
        player = { kind: query.kind, playerId: query.playerId };
      }
      return { records: await service.listRecords(request.user.id, player) };
    },
  );
}
