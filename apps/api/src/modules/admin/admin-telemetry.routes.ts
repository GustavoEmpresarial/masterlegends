import type { FastifyInstance } from 'fastify';
import { adminGuard } from '../../common/guards/admin.guard.js';
import {
  extractFailureFields,
  reportFailureSchema,
} from '../telemetry/failure-schema.js';

export async function registerAdminTelemetryRoutes(app: FastifyInstance) {
  app.post(
    '/telemetry/failures',
    {
      preHandler: [adminGuard],
      schema: { tags: ['admin', 'telemetry'], security: [{ bearerAuth: [] }] },
    },
    async (request, reply) => {
      const parsed = reportFailureSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ ok: false });
      }

      const fields = extractFailureFields(parsed.data);

      request.log.warn(
        {
          event: 'user_failure',
          kind: fields.kind,
          reason: fields.reason,
          surface: fields.surface,
          route: fields.route,
          area: fields.area,
          tab: fields.tab,
          userId: null,
          adminLogin: request.admin?.login ?? null,
          ip: request.ip,
          userAgent: request.headers['user-agent']?.slice(0, 256) ?? null,
          message: fields.message,
          context: fields.context,
        },
        'user_failure',
      );

      return { ok: true };
    },
  );
}
