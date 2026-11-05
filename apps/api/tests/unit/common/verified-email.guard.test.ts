import { describe, it, expect, vi } from 'vitest';
import { verifiedEmailGuard } from '../../../src/common/guards/verified-email.guard.js';
import { ErrorCode } from '@mll/shared';

function mockReply() {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
  return reply as any;
}

describe('verifiedEmailGuard', () => {
  it('rejects when user is missing on request', async () => {
    const reply = mockReply();
    await verifiedEmailGuard({ server: {} } as any, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send.mock.calls[0][0].error.code).toBe(ErrorCode.AUTH_UNAUTHORIZED);
  });

  it('rejects unverified email', async () => {
    const reply = mockReply();
    const request = {
      user: { id: 'u1' },
      server: {
        prisma: {
          user: {
            findUnique: vi.fn().mockResolvedValue({ emailVerifiedAt: null }),
          },
        },
      },
    } as any;
    await verifiedEmailGuard(request, reply);
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send.mock.calls[0][0].error.code).toBe(ErrorCode.AUTH_EMAIL_NOT_VERIFIED);
  });

  it('allows verified email', async () => {
    const reply = mockReply();
    const request = {
      user: { id: 'u1' },
      server: {
        prisma: {
          user: {
            findUnique: vi.fn().mockResolvedValue({ emailVerifiedAt: new Date() }),
          },
        },
      },
    } as any;
    await verifiedEmailGuard(request, reply);
    expect(reply.send).not.toHaveBeenCalled();
  });
});
