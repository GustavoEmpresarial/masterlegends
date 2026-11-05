import { describe, it, expect, vi } from 'vitest';
import { authGuard } from '../../../src/common/guards/auth.guard.js';
import { ErrorCode } from '../../../src/common/lib/errors.js';

function mockReply() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  } as any;
}

describe('JWT security (authGuard)', () => {
  it('rejects malformed Bearer token (verify throws)', async () => {
    const reply = mockReply();
    const request = {
      headers: { authorization: 'Bearer not-a-jwt' },
      server: {
        jwt: {
          verify: vi.fn(() => {
            throw new Error('invalid token');
          }),
        },
      },
    } as any;

    await authGuard(request, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send.mock.calls[0][0].error.code).toBe(ErrorCode.AUTH_UNAUTHORIZED);
  });

  it('rejects expired token when verify surfaces expiry', async () => {
    const reply = mockReply();
    const err = Object.assign(new Error('jwt expired'), { code: 'FAST_JWT_EXPIRED' });
    const request = {
      headers: { authorization: 'Bearer expired' },
      server: {
        jwt: {
          verify: vi.fn(() => {
            throw err;
          }),
        },
      },
    } as any;

    await authGuard(request, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it('rejects empty Bearer value', async () => {
    const reply = mockReply();
    await authGuard({ headers: { authorization: 'Bearer ' }, server: {} } as any, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it('rejects banned user after valid access token', async () => {
    const reply = mockReply();
    const request = {
      headers: { authorization: 'Bearer tok' },
      server: {
        jwt: {
          verify: vi.fn().mockReturnValue({ sub: 'u1', email: 'a@b.com', type: 'access' }),
        },
        prisma: {
          user: {
            findUnique: vi.fn().mockResolvedValue({
              bannedAt: new Date(),
              banReason: 'abuse',
            }),
          },
        },
      },
    } as any;

    await authGuard(request, reply);
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send.mock.calls[0][0].error.code).toBe(ErrorCode.USER_BANNED);
  });
});
