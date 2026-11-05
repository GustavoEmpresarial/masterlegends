import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { z } from 'zod';
import { AdminPermission } from '@mll/shared';
import { adminGuard, requireAdminPermission } from '../../common/guards/admin.guard.js';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { saveNoticeImage } from '../../common/lib/uploads.js';
import { NoticesService } from './notices.service.js';
import { createTelegramService, msgAnnouncement } from '../telegram/telegram.service.js';
import { NotificationType } from '@mll/shared';

const CATEGORIES = ['noticia', 'manutencao', 'evento', 'atualizacao'] as const;
const PRIORITIES = ['urgent', 'high', 'normal'] as const;

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES).optional(),
  imageUrl: z.string().max(512).nullable().optional(),
  active: z.boolean().optional(),
  showAsPopup: z.boolean().optional(),
  popupRepeatDaily: z.boolean().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
});

const patchSchema = createSchema.partial();

export function registerNoticesAdminRoutes(app: FastifyInstance) {
  const service = new NoticesService(app.prisma);
  const telegram = createTelegramService(app);

  app.get(
    '/notices',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => ({ notices: await service.listAll() }),
  );

  app.post(
    '/notices',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = createSchema.parse(request.body);
      const created = await service.create(body, request.admin.login);
      if (created.active) {
        const msg = msgAnnouncement(created.title, created.body);
        void telegram.enqueueGlobal(msg.text, NotificationType.ANNOUNCEMENT, msg.replyMarkup);
      }
      return created;
    },
  );

  app.patch(
    '/notices/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = patchSchema.parse(request.body);
      return service.update(id, body);
    },
  );

  app.patch(
    '/notices/:id/toggle',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.toggleActive(id);
    },
  );

  app.post(
    '/notices/upload-image',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const data = await (request as FastifyRequest & { file: () => Promise<MultipartFile> }).file();
      if (!data) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'empty_file' });
      }
      const buffer = await data.toBuffer();
      if (!buffer.byteLength) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'empty_file' });
      }
      const { url } = await saveNoticeImage(buffer, data.mimetype);
      return { url };
    },
  );

  app.delete(
    '/notices/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.remove(id);
    },
  );
}

export function registerNoticesPublicRoutes(app: FastifyInstance) {
  const service = new NoticesService(app.prisma);

  app.get(
    '/',
    { schema: { tags: ['notices'] } },
    async (request) => {
      const q = request.query as { category?: string; popup?: string };
      const popup = q.popup === 'true' ? true : q.popup === 'false' ? false : undefined;
      return { notices: await service.listPublic(q.category, popup) };
    },
  );
}
