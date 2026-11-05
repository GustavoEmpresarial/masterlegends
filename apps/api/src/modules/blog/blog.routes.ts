import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { blogPostCreateSchema, blogPostUpdateSchema, blogPostQuerySchema } from '@mll/shared';
import { AdminPermission } from '@mll/shared';
import { adminGuard, requireAdminPermission } from '../../common/guards/admin.guard.js';
import { saveBlogCoverImage } from '../../common/lib/uploads.js';
import { BlogService } from './blog.service.js';

export async function registerBlogRoutes(app: FastifyInstance) {
  const service = new BlogService(app.prisma);

  // ── Public routes (no auth required) ──────────────────────────────────────

  app.get(
    '/posts',
    { schema: { tags: ['blog'] } },
    async (request) => {
      const query = blogPostQuerySchema.parse(request.query);
      return service.listPublic(query);
    },
  );

  app.get(
    '/posts/:slug',
    { schema: { tags: ['blog'] } },
    async (request) => {
      const { slug } = request.params as { slug: string };
      return service.getBySlugPublic(slug);
    },
  );

  // ── Admin routes ───────────────────────────────────────────────────────────

  app.get(
    '/admin/posts',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['blog'], security: [{ bearerAuth: [] }] },
    },
    async () => service.adminList(),
  );

  app.get(
    '/admin/posts/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['blog'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.adminGet(id);
    },
  );

  app.post(
    '/admin/posts',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['blog'], security: [{ bearerAuth: [] }] },
    },
    async (request, reply) => {
      const body = blogPostCreateSchema.parse(request.body);
      const post = await service.create(body, request.admin.login);
      return reply.status(201).send(post);
    },
  );

  app.put(
    '/admin/posts/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['blog'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = blogPostUpdateSchema.parse(request.body);
      return service.update(id, body);
    },
  );

  app.post(
    '/admin/posts/:id/cover',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['blog'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const data = await (request as FastifyRequest & { file: () => Promise<MultipartFile> }).file();
      if (!data) throw new Error('No file uploaded');
      const buffer = await data.toBuffer();
      const { url } = await saveBlogCoverImage(buffer, data.mimetype);
      return service.updateCover(id, url);
    },
  );

  app.delete(
    '/admin/posts/:id/cover',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['blog'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.removeCover(id);
    },
  );

  app.delete(
    '/admin/posts/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['blog'], security: [{ bearerAuth: [] }] },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await service.delete(id);
      return reply.status(204).send();
    },
  );
}
