import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuditAction, AuditService } from './audit.js';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Captures every mutating admin request as an audit log entry.
 * Reads (GET/HEAD) are skipped to avoid spam.
 */
export function registerAdminAuditHook(app: FastifyInstance): void {
  const audit = new AuditService(app.prisma);

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!MUTATING_METHODS.has(request.method)) return;
    if (!request.admin) return;

    const status = reply.statusCode;
    const severity = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    // Params can include IDs (e.g. /items/:id) and query filters; bodies omitted intentionally
    // to keep audit small and avoid logging secrets.
    const params =
      Object.keys((request.params as Record<string, unknown>) ?? {}).length > 0
        ? request.params
        : undefined;
    const query =
      Object.keys((request.query as Record<string, unknown>) ?? {}).length > 0
        ? request.query
        : undefined;

    await audit.record({
      userId: null,
      action: AuditAction.ADMIN_REQUEST,
      severity,
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      meta: {
        adminId: request.admin.id,
        adminLogin: request.admin.login,
        adminRole: request.admin.role,
        method: request.method,
        url: request.url,
        routeOptions: (request as any).routeOptions?.url ?? (request as any).routerPath ?? null,
        params,
        query,
        statusCode: status,
      },
    });
  });
}
