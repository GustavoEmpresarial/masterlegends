import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PasswordResetService } from '../../../src/modules/auth/tokens/password-reset.service.js';
import { ErrorCode } from '../../../src/common/lib/errors.js';

function mockPrisma() {
  return {
    passwordResetToken: {
      create: vi.fn(async ({ data }: any) => data),
      findUnique: vi.fn(),
      update: vi.fn(async () => ({})),
    },
  } as any;
}

describe('PasswordResetService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: PasswordResetService;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new PasswordResetService(prisma);
  });

  it('issues reset token', async () => {
    const { token, expiresAt } = await service.issue('u1', '127.0.0.1');
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('consumes valid reset token', async () => {
    const { token } = await service.issue('u1');
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    const result = await service.consume(token);
    expect(result.userId).toBe('u1');
  });

  it('rejects expired token', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
    });
    await expect(service.consume('a'.repeat(32))).rejects.toMatchObject({
      code: ErrorCode.AUTH_RESET_TOKEN_INVALID,
    });
  });
});
