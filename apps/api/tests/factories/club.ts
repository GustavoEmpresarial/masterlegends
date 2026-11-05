import type { Club, PrismaClient } from '@prisma/client';
import { runWithSystemContext } from '../../src/common/lib/prisma-context.js';

let seq = 0;

export async function createTestClub(
  prisma: PrismaClient,
  userId: string,
  opts?: { name?: string; totalOverwall?: number },
): Promise<Club> {
  seq += 1;
  return runWithSystemContext(async () => {
    await prisma.mGTBalance.upsert({
      where: { userId },
      create: { userId, amount: 0, usdcAmount: 0 },
      update: {},
    });
    return prisma.club.create({
      data: {
        userId,
        name: opts?.name ?? `FC Factory ${seq}`,
        totalOverwall: opts?.totalOverwall ?? 0,
      },
    });
  });
}

export async function createTestBasePlayer(
  prisma: PrismaClient,
  userId: string,
  opts?: { overwall?: number; name?: string; position?: number },
) {
  return runWithSystemContext(async () =>
    prisma.basePlayer.create({
      data: {
        userId,
        rarity: 0,
        overwall: opts?.overwall ?? 100,
        position: opts?.position ?? 2,
        name: opts?.name ?? 'Factory Player',
        source: 'test',
      },
    }),
  );
}

export async function setGmtBalance(
  prisma: PrismaClient,
  userId: string,
  amount: number,
): Promise<void> {
  await runWithSystemContext(async () => {
    await prisma.mGTBalance.upsert({
      where: { userId },
      create: { userId, amount, usdcAmount: 0 },
      update: { amount },
    });
  });
}
