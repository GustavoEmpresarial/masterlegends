import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { z } from 'zod';
import { AdminPermission } from '@mll/shared';
import { adminGuard, requireAdminPermission } from '../../common/guards/admin.guard.js';
import { saveTransparencyImage, saveFinancialImage } from '../../common/lib/uploads.js';
import { TransparencyService } from './transparency.service.js';
import { FinancialService } from './financial.service.js';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  imageUrl: z.string().max(512).nullable().optional(),
  order: z.number().int().min(0).optional(),
  visible: z.boolean().optional(),
});

const patchSchema = createSchema.partial();

const financialCreateSchema = z.object({
  type: z.enum(['receita', 'despesa']),
  label: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  amount: z.number().min(0),
  currency: z.enum(['usdc', 'brl', 'usd']).default('usdc'),
  recurring: z.boolean().default(false),
  recurringPeriod: z.enum(['monthly', 'yearly']).nullable().optional(),
  source: z.string().max(200).nullable().optional(),
  referenceUrl: z.string().url().max(1024).nullable().optional(),
  imageUrl: z.string().max(512).nullable().optional(),
  date: z.string().datetime().optional(),
  visible: z.boolean().default(true),
});

const financialPatchSchema = financialCreateSchema.partial();

export function registerTransparencyAdminRoutes(app: FastifyInstance) {
  const service = new TransparencyService(app.prisma);
  const financialService = new FinancialService(app.prisma);

  app.get(
    '/transparency',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => ({ sections: await service.listAll() }),
  );

  app.post(
    '/transparency',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = createSchema.parse(request.body);
      return service.create(body);
    },
  );

  app.patch(
    '/transparency/:id',
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

  app.post(
    '/transparency/upload-image',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const data = await (request as FastifyRequest & { file: () => Promise<MultipartFile> }).file();
      if (!data) throw new Error('No file uploaded');
      const buffer = await data.toBuffer();
      const { url } = await saveTransparencyImage(buffer, data.mimetype);
      return { url };
    },
  );

  app.delete(
    '/transparency/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.remove(id);
    },
  );

  // ── Financial records ──────────────────────────────────────────────────────

  app.get(
    '/financial-records',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => ({ records: await financialService.listAll(), summary: await financialService.summary() }),
  );

  app.post(
    '/financial-records',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => financialService.create(financialCreateSchema.parse(request.body)),
  );

  app.patch(
    '/financial-records/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return financialService.update(id, financialPatchSchema.parse(request.body));
    },
  );

  app.post(
    '/financial-records/upload-image',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const data = await (request as FastifyRequest & { file: () => Promise<MultipartFile> }).file();
      if (!data) throw new Error('No file uploaded');
      const buffer = await data.toBuffer();
      const { url } = await saveFinancialImage(buffer, data.mimetype);
      return { url };
    },
  );

  app.delete(
    '/financial-records/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return financialService.remove(id);
    },
  );
}

export function registerTransparencyPublicRoutes(app: FastifyInstance) {
  const service = new TransparencyService(app.prisma);

  app.get(
    '/',
    { schema: { tags: ['transparency'] } },
    async () => ({ sections: await service.listVisible() }),
  );

  app.get(
    '/stats',
    { schema: { tags: ['transparency'] } },
    async () => service.publicStats(),
  );

  app.get(
    '/deposits',
    { schema: { tags: ['transparency'] } },
    async (request) => {
      const { page } = (request.query ?? {}) as { page?: string };
      return service.publicDeposits(Number(page ?? 1));
    },
  );

  const financialService = new FinancialService(app.prisma);

  app.get(
    '/financial-records',
    { schema: { tags: ['transparency'] } },
    async () => ({
      records: await financialService.listVisible(),
      summary: await financialService.summary(),
    }),
  );
}
