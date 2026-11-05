import type { FastifyInstance } from 'fastify';
import {
  extractFailureFields,
  reportFailureSchema,
  reportRateLimit,
} from './failure-schema.js';

export async function registerTelemetryFailureRoutes(app: FastifyInstance) {
  app.post(
    '/failures',
    {
      schema: { tags: ['telemetry'], security: [{ bearerAuth: [] }] },
      config: { rateLimit: reportRateLimit },
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
          userId: request.user?.id ?? null,
          adminLogin: null,
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
