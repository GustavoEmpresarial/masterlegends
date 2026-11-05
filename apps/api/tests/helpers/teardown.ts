import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { runWithSystemContext } from '../../src/common/lib/prisma-context.js';

export async function truncateAuthTables(prisma: PrismaClient): Promise<void> {
  await runWithSystemContext(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.emailVerificationToken.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.mGTBalance.deleteMany();
    await prisma.club.deleteMany();
    await prisma.user.deleteMany();
  });
}

export async function flushRedis(redis: Redis): Promise<void> {
  await redis.flushdb();
}
