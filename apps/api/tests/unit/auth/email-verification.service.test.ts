import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailVerificationService } from '../../../src/modules/auth/tokens/email-verification.service.js';
import { ErrorCode } from '../../../src/common/lib/errors.js';
import { hashToken } from '../../../src/modules/auth/tokens/hash.js';

function mockPrisma() {
  const store: Record<string, unknown> = {};
  return {
    emailVerificationToken: {
      create: vi.fn(async ({ data }: any) => {
        store.token = { ...data, id: 't1', consumedAt: null };
        return store.token;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.tokenHash === store.hash) return store.token;
        return null;
      }),
      update: vi.fn(async () => store.token),
    },
    user: { update: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (ops: unknown[]) => {
      for (const op of ops) await (op as Promise<unknown>);
    }),
  } as any;
}

describe('EmailVerificationService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: EmailVerificationService;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new EmailVerificationService(prisma);
  });

  it('issues plaintext token', async () => {
    const plain = await service.issue('u1');
    expect(plain.length).toBeGreaterThanOrEqual(32);
    expect(prisma.emailVerificationToken.create).toHaveBeenCalled();
  });

  it('consumes valid token', async () => {
    const plain = await service.issue('u1');
    (prisma.emailVerificationToken.findUnique as any).mockImplementation(async ({ where }: any) => ({
      id: 't1',
      userId: 'u1',
      tokenHash: where.tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    }));
    const result = await service.consume(plain);
    expect(result.userId).toBe('u1');
  });

  it('rejects invalid token', async () => {
    await expect(service.consume('x'.repeat(32))).rejects.toMatchObject({
      code: ErrorCode.AUTH_VERIFY_TOKEN_INVALID,
    });
  });
});
