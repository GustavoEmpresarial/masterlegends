import type { FastifyInstance } from 'fastify';
import { AdminPermission } from '@mll/shared';
import {
  roadmapItemCreateSchema,
  roadmapItemPatchSchema,
  roadmapPhaseCreateSchema,
  roadmapPhasePatchSchema,
  roadmapReorderSchema,
} from '@mll/shared';
import { adminGuard, requireAdminPermission } from '../../common/guards/admin.guard.js';
import { RoadmapService } from './roadmap.service.js';

export function registerRoadmapPublicRoutes(app: FastifyInstance) {
  const service = new RoadmapService(app.prisma);

  app.get(
    '/',
    { schema: { tags: ['roadmap'] } },
    async (request) => {
      const { locale } = (request.query ?? {}) as { locale?: string };
      return service.listPublic(locale);
    },
  );
}

export function registerRoadmapAdminRoutes(app: FastifyInstance) {
  const service = new RoadmapService(app.prisma);

  app.get(
    '/roadmap',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => service.listAdmin(),
  );

  app.post(
    '/roadmap/phases',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => service.createPhase(roadmapPhaseCreateSchema.parse(request.body)),
  );

  app.patch(
    '/roadmap/phases/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.updatePhase(id, roadmapPhasePatchSchema.parse(request.body));
    },
  );

  app.delete(
    '/roadmap/phases/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.deletePhase(id);
    },
  );

  app.post(
    '/roadmap/items',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => service.createItem(roadmapItemCreateSchema.parse(request.body)),
  );

  app.patch(
    '/roadmap/items/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.updateItem(id, roadmapItemPatchSchema.parse(request.body));
    },
  );

  app.delete(
    '/roadmap/items/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.deleteItem(id);
    },
  );

  app.patch(
    '/roadmap/reorder',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => service.reorder(roadmapReorderSchema.parse(request.body)),
  );
}
