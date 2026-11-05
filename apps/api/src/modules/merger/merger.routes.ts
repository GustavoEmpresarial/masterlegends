import type { FastifyInstance } from 'fastify';
import { mergeFuseSchema } from '@mll/shared';
import { ClubRepository } from '../club/club.repository.js';
import { ItemTemplateService } from '../items/item-template.service.js';
import { PassRepository, PassService } from '../pass/pass.service.js';
import { StadiumRepository } from '../stadium/stadium.repository.js';
import { MergerRepository } from './merger.repository.js';
import { MergerService } from './merger.service.js';

export async function registerMergerRoutes(app: FastifyInstance) {
  const service = new MergerService(
    new MergerRepository(app.prisma),
    new ClubRepository(app.prisma),
    new StadiumRepository(app.prisma),
    new ItemTemplateService(app.prisma),
    app.prisma,
    new PassService(new PassRepository(app.prisma), app.prisma),
  );

  app.get(
    '/rules',
    { schema: { tags: ['merger'], security: [{ bearerAuth: [] }] } },
    async () => service.getRules(),
  );

  app.post(
    '/fuse',
    { schema: { tags: ['merger'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const body = mergeFuseSchema.parse(request.body);
      return service.fuse(request.user.id, body);
    },
  );
}
