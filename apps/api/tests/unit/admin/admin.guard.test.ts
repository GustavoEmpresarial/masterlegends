import { describe, it, expect, vi } from 'vitest';
import {
  adminGuard,
  requireAdminPermission,
  requireAdminRole,
  extractAdminToken,
  verifyAdminTokenForBoard,
} from '../../../src/common/guards/admin.guard.js';
import { ErrorCode } from '@mll/shared';

vi.mock('../../../src/modules/admin/admin.config.js', () => ({
  findAdminById: (id: string) =>
    id ? { id, login: 'stub', role: 'super', email: 'stub@test.local', passwordHash: 'x' } : undefined,
}));

function mockReply() {
  const sent: { status?: number; body?: unknown } = {};
  return {
    status(code: number) {
      sent.status = code;
      return this;
    },
    send(body: unknown) {
      sent.body = body;
      return this;
    },
    sent,
  };
}

function adminJwtServer(verify: ReturnType<typeof vi.fn>) {
  return { jwt: { admin: { verify } } };
}

describe('adminGuard', () => {
  it('rejects missing bearer token', async () => {
    const reply = mockReply();
    await adminGuard(
      { headers: {}, cookies: {}, server: adminJwtServer(vi.fn()) } as never,
      reply as never,
    );
    expect(reply.sent.status).toBe(401);
    expect((reply.sent.body as { error: { code: string } }).error.code).toBe(
      ErrorCode.ADMIN_UNAUTHORIZED,
    );
  });

  it('accepts admin token from admin_access cookie when bearer is missing', async () => {
    const reply = mockReply();
    const request = {
      headers: {},
      cookies: { admin_access: 'cookie-token' },
      server: adminJwtServer(
        vi.fn().mockReturnValue({
          sub: 'admin-a',
          login: 'alice',
          role: 'super',
          email: 'a@test.local',
          type: 'admin',
        }),
      ),
      admin: undefined as unknown,
    };
    await adminGuard(request as never, reply as never);
    expect(request.admin).toEqual({
      id: 'admin-a',
      login: 'alice',
      role: 'super',
      email: 'a@test.local',
    });
  });

  it('falls back to admin_access cookie when bearer token is invalid', async () => {
    const reply = mockReply();
    const verify = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('invalid');
      })
      .mockReturnValue({
        sub: 'admin-b',
        login: 'bob',
        role: 'super',
        email: 'b@test.local',
        type: 'admin',
      });
    const request = {
      headers: { authorization: 'Bearer expired-token' },
      cookies: { admin_access: 'fresh-cookie-token' },
      server: adminJwtServer(verify),
      admin: undefined as unknown,
    };
    await adminGuard(request as never, reply as never);
    expect(verify).toHaveBeenCalledTimes(2);
    expect(request.admin).toEqual({
      id: 'admin-b',
      login: 'bob',
      role: 'super',
      email: 'b@test.local',
    });
  });

  it('rejects player access token', async () => {
    const reply = mockReply();
    await adminGuard(
      {
        headers: { authorization: 'Bearer player-token' },
        server: adminJwtServer(vi.fn().mockReturnValue({ sub: 'u1', type: 'access' })),
      } as never,
      reply as never,
    );
    expect(reply.sent.status).toBe(401);
  });

  it('rejects when JWT verification throws', async () => {
    const reply = mockReply();
    await adminGuard(
      {
        headers: { authorization: 'Bearer bad-token' },
        server: adminJwtServer(vi.fn().mockImplementation(() => { throw new Error('invalid'); })),
      } as never,
      reply as never,
    );
    expect(reply.sent.status).toBe(401);
  });

  it('accepts admin token', async () => {
    const reply = mockReply();
    const request = {
      headers: { authorization: 'Bearer admin-token' },
      server: adminJwtServer(
        vi.fn().mockReturnValue({
          sub: 'admin-a',
          login: 'alice',
          role: 'super',
          email: 'a@test.local',
          type: 'admin',
        }),
      ),
      admin: undefined as unknown,
    };
    await adminGuard(request as never, reply as never);
    expect(request.admin).toEqual({
      id: 'admin-a',
      login: 'alice',
      role: 'super',
      email: 'a@test.local',
    });
  });
});

describe('requireAdminPermission', () => {
  it('returns 401 when admin missing from request', async () => {
    const reply = mockReply();
    const handler = requireAdminPermission('manage_users' as any);
    await handler({ admin: undefined } as never, reply as never);
    expect(reply.sent.status).toBe(401);
  });

  it('returns 403 when admin lacks permission', async () => {
    const reply = mockReply();
    // 'support' role does NOT have 'manage_platform' permission
    const handler = requireAdminPermission('manage_platform' as any);
    const redisStub = { get: vi.fn().mockResolvedValue(null), set: vi.fn(), setex: vi.fn() };
    const request = {
      admin: { role: 'support', login: 'sup1', id: 'a1' },
      server: {
        prisma: { adminPermissionConfig: { findUnique: vi.fn().mockResolvedValue(null) } },
        redis: redisStub,
        redisQueue: redisStub,
      },
    } as never;
    await handler(request, reply as never);
    expect(reply.sent.status).toBe(403);
  });
});

describe('requireAdminRole', () => {
  it('returns 401 when admin not on request', async () => {
    const reply = mockReply();
    const handler = requireAdminRole('super' as any);
    await handler({ admin: undefined } as never, reply as never);
    expect(reply.sent.status).toBe(401);
  });

  it('returns 403 when role not in allowed list', async () => {
    const reply = mockReply();
    const handler = requireAdminRole('super' as any);
    await handler({ admin: { role: 'viewer' } } as never, reply as never);
    expect(reply.sent.status).toBe(403);
  });

  it('passes when role is allowed', async () => {
    const reply = mockReply();
    const handler = requireAdminRole('super' as any, 'moderator' as any);
    await handler({ admin: { role: 'moderator' } } as never, reply as never);
    expect(reply.sent.status).toBeUndefined();
  });
});

describe('extractAdminToken', () => {
  it('extracts token from Authorization header', () => {
    const req = { headers: { authorization: 'Bearer abc123' }, cookies: {} } as never;
    expect(extractAdminToken(req)).toBe('abc123');
  });

  it('extracts token from admin_access cookie as fallback', () => {
    const req = { headers: {}, cookies: { admin_access: 'cookie-token' } } as never;
    expect(extractAdminToken(req)).toBe('cookie-token');
  });

  it('returns undefined when no token available', () => {
    const req = { headers: {}, cookies: {} } as never;
    expect(extractAdminToken(req)).toBeUndefined();
  });
});

describe('verifyAdminTokenForBoard', () => {
  it('returns false and 401 when no token', async () => {
    const reply = mockReply();
    const result = await verifyAdminTokenForBoard(
      { headers: {}, cookies: {} } as never,
      reply as never,
      ['super' as any],
    );
    expect(result).toBe(false);
    expect(reply.sent.status).toBe(401);
  });

  it('returns false and 403 when role not allowed', async () => {
    const reply = mockReply();
    const result = await verifyAdminTokenForBoard(
      {
        headers: { authorization: 'Bearer token' },
        cookies: {},
        server: adminJwtServer(vi.fn().mockReturnValue({ type: 'admin', role: 'viewer', sub: 'a1', login: 'a', email: 'x' })),
      } as never,
      reply as never,
      ['super' as any],
    );
    expect(result).toBe(false);
    expect(reply.sent.status).toBe(403);
  });
});
