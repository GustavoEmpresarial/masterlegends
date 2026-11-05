import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

const recordedEntries: any[] = [];

vi.mock('../../../../src/common/lib/audit.js', async () => {
  const actual = await vi.importActual<typeof import('../../../../src/common/lib/audit.js')>(
    '../../../../src/common/lib/audit.js',
  );
  return {
    ...actual,
    AuditService: vi.fn().mockImplementation(() => ({
      record: vi.fn(async (entry: any) => {
        recordedEntries.push(entry);
      }),
    })),
  };
});

const { registerAdminAuditHook } = await import(
  '../../../../src/common/lib/admin-audit-hook.js'
);

async function buildApp(opts: { withAdmin?: boolean } = { withAdmin: true }) {
  const app = Fastify();
  (app as any).prisma = {};
  app.addHook('onRequest', async (req) => {
    if (opts.withAdmin) {
      (req as any).admin = { id: 'a1', login: 'admin', role: 'super' };
    }
  });
  registerAdminAuditHook(app as any);

  app.get('/items', async () => ({ items: [] }));
  app.post('/items/:id/active', async (req) => ({ id: (req.params as any).id }));
  app.delete('/items/:id', async (req, reply) => {
    reply.status(204);
    return null;
  });
  app.patch('/broken', async () => {
    throw new Error('boom');
  });

  return app;
}

beforeEach(() => {
  recordedEntries.length = 0;
  vi.clearAllMocks();
});

describe('admin audit hook', () => {
  it('does not record GET requests', async () => {
    const app = await buildApp();
    await app.inject({ method: 'GET', url: '/items' });
    expect(recordedEntries).toHaveLength(0);
    await app.close();
  });

  it('records POST with params + admin info', async () => {
    const app = await buildApp();
    await app.inject({ method: 'POST', url: '/items/abc/active' });
    expect(recordedEntries).toHaveLength(1);
    expect(recordedEntries[0]).toMatchObject({
      action: 'admin_request',
      severity: 'info',
      meta: expect.objectContaining({
        method: 'POST',
        adminId: 'a1',
        adminLogin: 'admin',
        adminRole: 'super',
        statusCode: 200,
        params: { id: 'abc' },
      }),
    });
    await app.close();
  });

  it('records DELETE with 204 as info', async () => {
    const app = await buildApp();
    await app.inject({ method: 'DELETE', url: '/items/xyz' });
    expect(recordedEntries[0]).toMatchObject({
      severity: 'info',
      meta: expect.objectContaining({ statusCode: 204, method: 'DELETE' }),
    });
    await app.close();
  });

  it('records 5xx with error severity', async () => {
    const app = await buildApp();
    await app.inject({ method: 'PATCH', url: '/broken' });
    expect(recordedEntries[0].severity).toBe('error');
    expect(recordedEntries[0].meta.statusCode).toBeGreaterThanOrEqual(500);
    await app.close();
  });

  it('skips requests without admin (defense in depth)', async () => {
    const app = await buildApp({ withAdmin: false });
    await app.inject({ method: 'POST', url: '/items/abc/active' });
    expect(recordedEntries).toHaveLength(0);
    await app.close();
  });
});
