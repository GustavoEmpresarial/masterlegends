import { FastifyInstance } from 'fastify';
import { mintSchema } from '@mll/shared';
import { JobQueues } from '../../common/lib/queues.js';
import { ClubRepository } from '../club/club.repository.js';
import { ClubService } from '../club/club.service.js';
import { StadiumRepository } from '../stadium/stadium.repository.js';
import { StaminaService } from '../stamina/stamina.service.js';
import { VestiarioTemplateRepository } from '../vestiario/vestiario-template.repository.js';
import { PassRepository, PassService } from '../pass/pass.service.js';
import { ItemTemplateService } from '../items/item-template.service.js';
import { ScoutRepository } from './scout.repository.js';
import { ScoutService } from './scout.service.js';

export async function registerScoutRoutes(app: FastifyInstance) {
  const clubRepo = new ClubRepository(app.prisma);
  const clubService = new ClubService(
    clubRepo,
    new StaminaService(
      app.prisma,
      clubRepo,
      new StadiumRepository(app.prisma),
      new VestiarioTemplateRepository(app.prisma),
    ),
    app.prisma,
    new JobQueues(app.redisQueue),
    app.redis,
  );
  const passService = new PassService(new PassRepository(app.prisma), app.prisma);
  const service = new ScoutService(
    new ScoutRepository(app.prisma),
    clubService,
    new ItemTemplateService(app.prisma),
    passService,
    new JobQueues(app.redisQueue),
    app.prisma,
  );

  app.get(
    '/rules',
    { schema: { tags: ['scout'], security: [{ bearerAuth: [] }] } },
    async () => service.getRules(),
  );

  app.post(
    '/mint',
    {
      config: {},
      schema: { tags: ['scout'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = mintSchema.parse(request.body);
      const result = await service.mint(request.user.id, body);
      const { bumpQuestTrigger } = await import('../events/events.routes.js');
      await bumpQuestTrigger(app, request.user.id, 'scout_mint', body.quantity ?? 1);
      return result;
    },
  );
}
