import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { supportMessageSchema, supportTicketCreateSchema } from '@mll/shared';
import { config } from '../../config/env.js';
import { consumeMultipart } from '../../common/lib/multipart.js';
import { AppError } from '../../common/lib/errors.js';
import { SupportService } from './support.service.js';

function logSupportFailure(req: FastifyRequest, kind: string, err: unknown): void {
  const reason =
    err instanceof AppError
      ? (err.details as { reason?: string } | undefined)?.reason ?? err.code
      : err instanceof Error
        ? err.name
        : 'unknown';
  req.log.warn(
    {
      event: 'user_failure',
      kind,
      reason,
      userId: req.user?.id ?? null,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.slice(0, 256) ?? null,
    },
    'user_failure',
  );
}

const supportUploadRateLimit = {
  max: 10,
  timeWindow: '1 hour',
};

async function sendAttachment(reply: FastifyReply, mimeType: string, buffer: Buffer): Promise<void> {
  reply
    .header('Content-Type', mimeType)
    .header('Content-Disposition', 'inline; filename="attachment"')
    .header('X-Content-Type-Options', 'nosniff')
    .header('Cache-Control', 'private, no-store')
    .send(buffer);
}

export async function registerSupportRoutes(app: FastifyInstance) {
  const service = new SupportService(app.prisma);

  app.post(
    '/tickets',
    {
      schema: { tags: ['support'], security: [{ bearerAuth: [] }] },
      config: { rateLimit: supportUploadRateLimit },
    },
    async (request) => {
      const contentType = request.headers['content-type'] ?? '';
      let subject: string;
      let category: string;
      let message: string;
      let imageBuffers: Buffer[] = [];

      if (contentType.includes('multipart/form-data')) {
        const { fields, files } = await consumeMultipart(request as never, {
          maxFiles: config.SUPPORT_UPLOAD_MAX_FILES,
        });
        const parsed = supportTicketCreateSchema.parse({
          subject: fields.subject,
          category: fields.category ?? 'general',
          message: fields.message ?? '',
        });
        subject = parsed.subject;
        category = parsed.category;
        message = parsed.message;
        imageBuffers = files.map((f) => f.buffer);
      } else {
        const body = supportTicketCreateSchema.parse(request.body);
        subject = body.subject;
        category = body.category;
        message = body.message;
      }

      try {
        const ticket = await service.createTicket(request.user.id, { subject, category, message }, imageBuffers);
        return { ticket };
      } catch (err) {
        logSupportFailure(request, 'support_submit', err);
        throw err;
      }
    },
  );

  app.get(
    '/tickets',
    { schema: { tags: ['support'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const tickets = await service.listForUser(request.user.id);
      return { tickets };
    },
  );

  app.get(
    '/unread',
    { schema: { tags: ['support'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const tickets = await service.listUnreadForUser(request.user.id);
      return { tickets };
    },
  );

  app.get(
    '/tickets/:id',
    { schema: { tags: ['support'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const { id } = request.params as { id: string };
      return service.getTicketForUser(request.user.id, id);
    },
  );

  app.post(
    '/tickets/:id/messages',
    {
      schema: { tags: ['support'], security: [{ bearerAuth: [] }] },
      config: { rateLimit: supportUploadRateLimit },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const contentType = request.headers['content-type'] ?? '';
      let body: string;
      let imageBuffers: Buffer[] = [];

      if (contentType.includes('multipart/form-data')) {
        const { fields, files } = await consumeMultipart(request as never, {
          maxFiles: config.SUPPORT_UPLOAD_MAX_FILES,
        });
        const parsed = supportMessageSchema.parse({ body: fields.body ?? '' });
        body = parsed.body;
        imageBuffers = files.map((f) => f.buffer);
      } else {
        const parsed = supportMessageSchema.parse(request.body);
        body = parsed.body;
      }

      try {
        const message = await service.addUserMessage(request.user.id, id, body, imageBuffers);
        return { message };
      } catch (err) {
        logSupportFailure(request, 'support_upload', err);
        throw err;
      }
    },
  );

  app.get(
    '/attachments/:id',
    { schema: { tags: ['support'], security: [{ bearerAuth: [] }] } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { file } = await service.getAttachmentForUser(request.user.id, id);
      await sendAttachment(reply, file.mimeType, file.buffer);
    },
  );
}
