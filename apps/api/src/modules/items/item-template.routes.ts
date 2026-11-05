import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import {
  AdminPermission,
  itemTemplateActiveSchema,
  itemTemplateCreateSchema,
  itemTemplatePatchSchema,
} from '@mll/shared';
import { adminGuard, requireAdminPermission } from '../../common/guards/admin.guard.js';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { saveItemImage } from '../../common/lib/uploads.js';
import { ItemTemplateService } from './item-template.service.js';

async function consumeMultipart(
  req: any,
): Promise<{ fields: Record<string, string>; file?: { buffer: Buffer; mime: string } }> {
  const fields: Record<string, string> = {};
  let file: { buffer: Buffer; mime: string } | undefined;

  const parts = req.parts() as AsyncIterable<any>;
  for await (const part of parts) {
    if (part.type === 'file') {
      const buf = await part.toBuffer();
      file = { buffer: buf, mime: part.mimetype };
    } else if (part.type === 'field' && typeof part.value === 'string') {
      fields[part.fieldname] = part.value;
    }
  }
  return { fields, file };
}

function parseCreateFields(fields: Record<string, string>) {
  const parsed = itemTemplateCreateSchema.parse({
    name: fields.name,
    rarity: Number(fields.rarity),
    position: Number(fields.position),
    overwall: Number(fields.overwall),
    weight: fields.weight !== undefined ? Number(fields.weight) : 1,
    active: fields.active === undefined ? true : fields.active === 'true',
  });
  return parsed;
}

function parsePatchFields(fields: Record<string, string>) {
  const candidate: Record<string, unknown> = {};
  if (fields.name !== undefined) candidate.name = fields.name;
  if (fields.rarity !== undefined) candidate.rarity = Number(fields.rarity);
  if (fields.position !== undefined) candidate.position = Number(fields.position);
  if (fields.overwall !== undefined) candidate.overwall = Number(fields.overwall);
  if (fields.weight !== undefined) candidate.weight = Number(fields.weight);
  if (fields.active !== undefined) candidate.active = fields.active === 'true';
  return parsePatchBody(candidate);
}

function parsePatchBody(body: unknown) {
  try {
    return itemTemplatePatchSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
        issues: err.flatten().fieldErrors,
        message: 'Invalid item fields.',
      });
    }
    throw err;
  }
}

function isValidMultipart(request: any): boolean {
  const contentType = String(request.headers['content-type'] ?? '');
  if (!contentType.includes('multipart/form-data')) return false;
  if (!contentType.includes('boundary=')) return false;
  return typeof request.isMultipart === 'function' ? request.isMultipart() : false;
}

export async function registerItemTemplateRoutes(app: FastifyInstance) {
  const service = new ItemTemplateService(app.prisma);

  app.get(
    '/items',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ITEMS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { rarity, active, limit } = request.query as {
        rarity?: string;
        active?: string;
        limit?: string;
      };
      const items = await service.list({
        rarity: rarity !== undefined ? Number(rarity) : undefined,
        active: active === undefined ? undefined : active === 'true',
        limit: limit !== undefined ? Number(limit) : undefined,
      });
      return { items };
    },
  );

  app.post(
    '/items',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ITEMS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { fields, file } = await consumeMultipart(request);
      if (!file) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'image_required' });
      }
      const data = parseCreateFields(fields);
      const { url } = await saveItemImage(file.buffer, file.mime);
      return service.create({ ...data, imageUrl: url }, request.admin.login);
    },
  );

  app.patch(
    '/items/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ITEMS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };

      if (isValidMultipart(request)) {
        const { fields, file } = await consumeMultipart(request);
        const patch = parsePatchFields(fields);
        let imageUrl: string | undefined;
        if (file) {
          const saved = await saveItemImage(file.buffer, file.mime);
          imageUrl = saved.url;
        }
        return service.update(id, { ...patch, ...(imageUrl ? { imageUrl } : {}) });
      }

      const body = request.body;
      if (body == null || typeof body !== 'object' || Array.isArray(body)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
          reason: 'invalid_body',
          message: 'Send JSON body or multipart/form-data with a valid boundary.',
        });
      }

      const patch = parsePatchBody(body);
      return service.update(id, patch);
    },
  );

  app.post(
    '/items/:id/active',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ITEMS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = itemTemplateActiveSchema.parse(request.body);
      return service.setActive(id, body.active);
    },
  );

  app.delete(
    '/items/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ITEMS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await service.delete(id);
      reply.status(204);
      return null;
    },
  );
}
