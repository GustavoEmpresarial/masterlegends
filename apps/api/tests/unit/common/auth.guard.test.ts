import { describe, it, expect, vi } from 'vitest';
import { authGuard } from '../../../src/common/guards/auth.guard.js';
import { ErrorCode } from '../../../src/common/lib/errors.js';
import { initRequestContext } from '../../../src/common/lib/prisma-context.js';

function mockReply() {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
  return reply as any;
}

describe('authGuard', () => {
  it('rejects missing authorization', async () => {
    const reply = mockReply();
    await authGuard({ headers: {}, server: {} } as any, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send.mock.calls[0][0].error.code).toBe(ErrorCode.AUTH_UNAUTHORIZED);
  });

  it('rejects token without type field', async () => {
    const reply = mockReply();
    const request = {
      headers: { authorization: 'Bearer tok' },
      server: {
        jwt: { verify: vi.fn().mockReturnValue({ sub: 'u1', email: 'a@b.com' }) },
      },
    } as any;
    await authGuard(request, reply);
    expect(reply.send.mock.calls[0][0].error.code).toBe(ErrorCode.AUTH_INVALID_TOKEN_TYPE);
  });

  it('rejects refresh token type', async () => {
    const reply = mockReply();
    const request = {
      headers: { authorization: 'Bearer tok' },
      server: {
        jwt: { verify: vi.fn().mockReturnValue({ sub: 'u1', type: 'refresh' }) },
      },
    } as any;
    await authGuard(request, reply);
    expect(reply.send.mock.calls[0][0].error.code).toBe(ErrorCode.AUTH_INVALID_TOKEN_TYPE);
  });

  it('attaches user for access token', async () => {
    const reply = mockReply();
    const request = {
      headers: { authorization: 'Bearer tok' },
      server: {
        jwt: { verify: vi.fn().mockReturnValue({ sub: 'u1', email: 'a@b.com', type: 'access' }) },
        prisma: {
          user: {
            findUnique: vi.fn().mockResolvedValue({ bannedAt: null, banReason: null }),
          },
        },
      },
    } as any;
    await authGuard(request, reply);
    expect(request.user).toEqual({ id: 'u1', email: 'a@b.com', wallet: undefined });
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('allows ban check under player scope (/api/*)', async () => {
    initRequestContext('player');
    const reply = mockReply();
    const findUnique = vi.fn().mockResolvedValue({ bannedAt: null, banReason: null });
    const request = {
      headers: { authorization: 'Bearer tok' },
      server: {
        jwt: { verify: vi.fn().mockReturnValue({ sub: 'u1', email: 'a@b.com', type: 'access' }) },
        prisma: { user: { findUnique } },
      },
    } as any;
    await authGuard(request, reply);
    expect(findUnique).toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });
});
