import type { PrismaClient, User } from '@prisma/client';
import { runWithSystemContext } from '../../src/common/lib/prisma-context.js';

let seq = 0;

export async function createTestUser(
  prisma: PrismaClient,
  opts?: {
    email?: string;
    username?: string;
    emailVerified?: boolean;
    gmtBalance?: number;
  },
): Promise<User> {
  seq += 1;
  const n = seq;
  return runWithSystemContext(async () => {
    const user = await prisma.user.create({
      data: {
        email: opts?.email ?? `factory.user.${n}@gmail.com`,
        username: (opts?.username ?? `factory${n}`).slice(0, 20),
        password: 'test-hash',
        referralCode: `F${String(n).padStart(7, '0')}`.slice(0, 8),
        emailVerifiedAt: opts?.emailVerified === false ? null : new Date(),
      },
    });
    if (opts?.gmtBalance != null) {
      await prisma.mGTBalance.upsert({
        where: { userId: user.id },
        create: { userId: user.id, amount: opts.gmtBalance, usdcAmount: 0 },
        update: { amount: opts.gmtBalance },
      });
    }
    return user;
  });
}
