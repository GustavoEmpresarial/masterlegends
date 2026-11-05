import type { FastifyInstance } from 'fastify';
import {
  AdminPermission,
  parseStadiumSlotsJson,
  stadiumTemplateActiveSchema,
  stadiumTemplateCreateSchema,
  stadiumTemplatePatchSchema,
} from '@mll/shared';
import { adminGuard, requireAdminPermission } from '../../common/guards/admin.guard.js';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { saveStadiumImage } from '../../common/lib/uploads.js';
import { StadiumRepository } from './stadium.repository.js';
import { StadiumService } from './stadium.service.js';

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

function parsePriceUsdc(raw: string | undefined): number | null | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (raw === 'null') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseCreateFields(fields: Record<string, string>) {
  const slots = parseStadiumSlotsJson(fields.slots ?? '[]');
  return stadiumTemplateCreateSchema.parse({
    name: fields.name,
    slots,
    priceUsdc: parsePriceUsdc(fields.priceUsdc),
    active: fields.active === undefined ? false : fields.active === 'true',
    isDefault: fields.isDefault === 'true',
    sortOrder: fields.sortOrder !== undefined ? Number(fields.sortOrder) : 0,
    farmBonusPct: fields.farmBonusPct !== undefined ? Number(fields.farmBonusPct) : undefined,
    requireRareStarters:
      fields.requireRareStarters !== undefined ? Number(fields.requireRareStarters) : undefined,
    requireMinOverwall:
      fields.requireMinOverwall !== undefined ? Number(fields.requireMinOverwall) : undefined,
    requireOwnedTemplateId: parseOptionalUuid(fields.requireOwnedTemplateId),
    requirementNote: parseOptionalNote(fields.requirementNote),
  });
}

function parsePatchFields(fields: Record<string, string>) {
  const candidate: Record<string, unknown> = {};
  if (fields.name !== undefined) candidate.name = fields.name;
  if (fields.slots !== undefined) candidate.slots = parseStadiumSlotsJson(fields.slots);
  if (fields.priceUsdc !== undefined) candidate.priceUsdc = parsePriceUsdc(fields.priceUsdc);
  if (fields.active !== undefined) candidate.active = fields.active === 'true';
  if (fields.isDefault !== undefined) candidate.isDefault = fields.isDefault === 'true';
  if (fields.sortOrder !== undefined) candidate.sortOrder = Number(fields.sortOrder);
  if (fields.farmBonusPct !== undefined) candidate.farmBonusPct = Number(fields.farmBonusPct);
  if (fields.requireRareStarters !== undefined) {
    candidate.requireRareStarters = Number(fields.requireRareStarters);
  }
  if (fields.requireMinOverwall !== undefined) {
    candidate.requireMinOverwall = Number(fields.requireMinOverwall);
  }
  if (fields.requireOwnedTemplateId !== undefined) {
    candidate.requireOwnedTemplateId = parseOptionalUuid(fields.requireOwnedTemplateId);
  }
  if (fields.requirementNote !== undefined) {
    candidate.requirementNote = parseOptionalNote(fields.requirementNote);
  }
  return stadiumTemplatePatchSchema.parse(candidate);
}

function parseOptionalUuid(raw: string | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === '' || raw === 'null') return null;
  return raw;
}

function parseOptionalNote(raw: string | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === '' || raw === 'null') return null;
  return raw;
}

export async function registerStadiumRoutes(app: FastifyInstance) {
  const service = new StadiumService(new StadiumRepository(app.prisma));

  app.get(
    '/stadiums',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_STADIUMS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { active, limit } = request.query as { active?: string; limit?: string };
      const stadiums = await service.list({
        active: active === undefined ? undefined : active === 'true',
        limit: limit !== undefined ? Number(limit) : undefined,
      });
      return { stadiums };
    },
  );

  app.get(
    '/stadiums/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_STADIUMS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.getById(id);
    },
  );

  app.post(
    '/stadiums',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_STADIUMS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { fields, file } = await consumeMultipart(request);
      if (!file) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'image_required' });
      }
      const data = parseCreateFields(fields);
      const { url } = await saveStadiumImage(file.buffer, file.mime);
      return service.create({ ...data, imageUrl: url });
    },
  );

  app.patch(
    '/stadiums/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_STADIUMS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const isMultipart =
        typeof (request as any).isMultipart === 'function'
          ? (request as any).isMultipart()
          : false;
      if (isMultipart) {
        const { fields, file } = await consumeMultipart(request);
        const patch = parsePatchFields(fields);
        let imageUrl: string | undefined;
        if (file) {
          const saved = await saveStadiumImage(file.buffer, file.mime);
          imageUrl = saved.url;
        }
        return service.update(id, { ...patch, ...(imageUrl ? { imageUrl } : {}) });
      }
      const body = stadiumTemplatePatchSchema.parse(request.body);
      return service.update(id, body);
    },
  );

  app.post(
    '/stadiums/:id/active',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_STADIUMS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = stadiumTemplateActiveSchema.parse(request.body);
      return service.setActive(id, body.active);
    },
  );

  app.delete(
    '/stadiums/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_STADIUMS)],
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
