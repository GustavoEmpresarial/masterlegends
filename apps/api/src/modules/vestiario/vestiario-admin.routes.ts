import type { FastifyInstance } from 'fastify';
import { AdminPermission, parseStadiumSlotsJson, vestiarioTemplatePatchSchema } from '@mll/shared';
import { adminGuard, requireAdminPermission } from '../../common/guards/admin.guard.js';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { deleteVestiarioMedia, saveVestiarioMedia } from '../../common/lib/uploads.js';
import { VestiarioTemplateRepository } from './vestiario-template.repository.js';
import { VestiarioTemplateService } from './vestiario-template.service.js';

async function consumeMultipart(
  req: { parts: () => AsyncIterable<{ type: string; fieldname: string; value?: string; toBuffer: () => Promise<Buffer>; mimetype: string }> },
): Promise<{ fields: Record<string, string>; file?: { buffer: Buffer; mime: string } }> {
  const fields: Record<string, string> = {};
  let file: { buffer: Buffer; mime: string } | undefined;
  for await (const part of req.parts()) {
    if (part.type === 'file') {
      const buf = await part.toBuffer();
      file = { buffer: buf, mime: part.mimetype };
    } else if (part.type === 'field' && typeof part.value === 'string') {
      fields[part.fieldname] = part.value;
    }
  }
  return { fields, file };
}

export async function registerVestiarioAdminRoutes(app: FastifyInstance) {
  const service = new VestiarioTemplateService(new VestiarioTemplateRepository(app.prisma));
  const guard = [adminGuard, requireAdminPermission(AdminPermission.MANAGE_STADIUMS)];
  const schema = { tags: ['admin'], security: [{ bearerAuth: [] }] };

  // ── Legacy single-get (kept for backwards compat with user-facing route) ──
  app.get('/vestiario-template', { preHandler: guard, schema }, async () => service.get());

  // ── List all ──
  app.get('/vestiario-templates', { preHandler: guard, schema }, async () => {
    const templates = await service.list();
    return { templates };
  });

  // ── Create ──
  app.post(
    '/vestiario-templates',
    { preHandler: guard, schema },
    async (request) => {
      const isMultipart = typeof (request as any).isMultipart === 'function'
        ? (request as any).isMultipart() : false;

      if (!isMultipart) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'multipart_required' });
      }

      const { fields, file } = await consumeMultipart(request as never);
      if (!file) throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'image_required' });

      const name = (fields.name ?? 'Novo Vestiário').trim().slice(0, 64) || 'Novo Vestiário';
      const slots = fields.slots !== undefined ? parseStadiumSlotsJson(fields.slots) : [];
      const saved = await saveVestiarioMedia(file.buffer, file.mime);

      return service.create({ name, imageUrl: saved.url, backgroundType: saved.backgroundType, slots });
    },
  );

  // ── Update ──
  app.patch(
    '/vestiario-templates/:id',
    { preHandler: guard, schema },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await service.getById(id);
      if (!existing) return reply.status(404).send({ error: 'Not found' });

      const isMultipart = typeof (request as any).isMultipart === 'function'
        ? (request as any).isMultipart() : false;

      let imageUrl: string | undefined;
      let backgroundType: 'image' | 'video' | undefined;
      let slots: ReturnType<typeof parseStadiumSlotsJson> | undefined;
      let name: string | undefined;
      let active: boolean | undefined;

      if (isMultipart) {
        const { fields, file } = await consumeMultipart(request as never);
        if (fields.name) name = fields.name.trim().slice(0, 64);
        if (fields.active !== undefined) active = fields.active === 'true';
        if (fields.slots !== undefined) slots = parseStadiumSlotsJson(fields.slots);
        if (file) {
          const saved = await saveVestiarioMedia(file.buffer, file.mime);
          if (existing.imageUrl && existing.imageUrl !== saved.url) {
            await deleteVestiarioMedia(existing.imageUrl);
          }
          imageUrl = saved.url;
          backgroundType = saved.backgroundType;
        }
      } else {
        const body = request.body as Record<string, unknown>;
        const parsed = vestiarioTemplatePatchSchema.partial().parse(body);
        if (parsed.slots) slots = parsed.slots;
        if (typeof body.name === 'string') name = body.name.trim().slice(0, 64);
        if (typeof body.active === 'boolean') active = body.active;
      }

      return service.update(id, { name, imageUrl, backgroundType, slots, active });
    },
  );

  // ── Legacy PATCH (single template) — kept for VestiarioBuilder compat ──
  app.patch(
    '/vestiario-template',
    { preHandler: guard, schema },
    async (request) => {
      const isMultipart = typeof (request as any).isMultipart === 'function'
        ? (request as any).isMultipart() : false;

      const current = await service.get();

      if (isMultipart) {
        const { fields, file } = await consumeMultipart(request as never);
        const slots = fields.slots !== undefined ? parseStadiumSlotsJson(fields.slots) : undefined;
        let imageUrl: string | undefined;
        let backgroundType: 'image' | 'video' | undefined;
        if (file) {
          const saved = await saveVestiarioMedia(file.buffer, file.mime);
          if (current.imageUrl && current.imageUrl !== saved.url) {
            await deleteVestiarioMedia(current.imageUrl);
          }
          imageUrl = saved.url;
          backgroundType = saved.backgroundType;
        }
        if (!imageUrl && slots === undefined) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'nothing_to_update' });
        }
        return service.update(current.id, { imageUrl, backgroundType, slots });
      }

      const body = vestiarioTemplatePatchSchema.parse(request.body);
      return service.update(current.id, body);
    },
  );

  // ── Set default ──
  app.post(
    '/vestiario-templates/:id/default',
    { preHandler: guard, schema },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await service.getById(id);
      if (!existing) return reply.status(404).send({ error: 'Not found' });
      return service.setDefault(id);
    },
  );

  // ── Toggle active ──
  app.post(
    '/vestiario-templates/:id/active',
    { preHandler: guard, schema },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { active: boolean };
      const existing = await service.getById(id);
      if (!existing) return reply.status(404).send({ error: 'Not found' });
      return service.update(id, { active: body.active });
    },
  );

  // ── Delete ──
  app.delete(
    '/vestiario-templates/:id',
    { preHandler: guard, schema },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await service.delete(id);
        return { ok: true };
      } catch (err: unknown) {
        return reply.status(400).send({ error: (err as Error).message });
      }
    },
  );
}
