import type { Prisma, PrismaClient } from '@prisma/client';

export const STAMINA_REASONS = [
  'match',
  'training',
  'special',
  'field',
  'daily_rest',
  'coach',
  'shop',
  'event_item',
] as const;

export type StaminaReason = (typeof STAMINA_REASONS)[number];

export interface StaminaLedgerEntry {
  userId: string;
  playerKind: 'base' | 'nft';
  playerId: string;
  reason: StaminaReason;
  before: number;
  after: number;
}

type LedgerDb = PrismaClient | Prisma.TransactionClient;

export async function writeStaminaLedger(db: LedgerDb, entry: StaminaLedgerEntry): Promise<void> {
  if (entry.before === entry.after) return;
  const delta = entry.after - entry.before;
  await db.$executeRaw`
    INSERT INTO "StaminaLedger" ("id", "userId", "playerKind", "playerId", "reason", "delta", "before", "after", "createdAt")
    VALUES (
      gen_random_uuid()::text,
      ${entry.userId},
      ${entry.playerKind},
      ${entry.playerId},
      ${entry.reason},
      ${delta},
      ${entry.before},
      ${entry.after},
      NOW()
    )
  `;
}

export interface StaminaHistoryItem {
  reason: StaminaReason;
  delta: number;
  before: number;
  after: number;
  createdAt: string;
}

export async function listStaminaHistory(
  prisma: PrismaClient,
  userId: string,
  playerKind: 'base' | 'nft',
  playerId: string,
): Promise<StaminaHistoryItem[]> {
  if (playerKind === 'base') {
    const owned = await prisma.basePlayer.findFirst({
      where: { id: playerId, userId },
      select: { id: true },
    });
    if (!owned) return [];
  } else {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { wallet: true },
    });
    const wallet = user?.wallet?.toLowerCase();
    if (!wallet) return [];
    let tokenId: bigint;
    try {
      tokenId = BigInt(playerId);
    } catch {
      return [];
    }
    const owned = await prisma.playerCache.findFirst({
      where: { tokenId, ownerWallet: wallet },
      select: { tokenId: true },
    });
    if (!owned) return [];
  }

  const rows = await prisma.$queryRaw<
    Array<{ reason: string; delta: number; before: number; after: number; createdAt: Date }>
  >`
    SELECT "reason", "delta", "before", "after", "createdAt"
    FROM "StaminaLedger"
    WHERE "userId" = ${userId}
      AND "playerKind" = ${playerKind}
      AND "playerId" = ${playerId}
    ORDER BY "createdAt" DESC
    LIMIT 12
  `;

  return rows.map((row) => ({
    reason: row.reason as StaminaReason,
    delta: Number(row.delta),
    before: Number(row.before),
    after: Number(row.after),
    createdAt: new Date(row.createdAt).toISOString(),
  }));
}
