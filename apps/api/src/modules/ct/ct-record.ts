import type { Prisma, PrismaClient } from '@prisma/client';
import { Prisma as PrismaNs } from '@prisma/client';
import { evolveMainAttribute, readPlayerAttributes, type PlayerAttributes } from '@mll/shared';

export type CtRecordKind = 'training' | 'evolution' | 'progression';

export interface CtRecordItem {
  id: string;
  playerKind: 'base' | 'nft' | null;
  playerId: string | null;
  kind: CtRecordKind;
  before: number | null;
  after: number | null;
  detail: string | null;
  createdAt: string;
}

type LedgerDb = PrismaClient | Prisma.TransactionClient;

export async function writeCtRecord(
  db: LedgerDb,
  entry: {
    userId: string;
    playerKind?: 'base' | 'nft' | null;
    playerId?: string | null;
    kind: CtRecordKind;
    before?: number | null;
    after?: number | null;
    detail?: string | null;
  },
): Promise<void> {
  await db.$executeRaw`
    INSERT INTO "CtRecord" ("id", "userId", "playerKind", "playerId", "kind", "before", "after", "detail", "createdAt")
    VALUES (
      gen_random_uuid()::text,
      ${entry.userId},
      ${entry.playerKind ?? null},
      ${entry.playerId ?? null},
      ${entry.kind},
      ${entry.before ?? null},
      ${entry.after ?? null},
      ${entry.detail ?? null},
      NOW()
    )
  `;
}

export async function listCtRecords(
  prisma: PrismaClient,
  userId: string,
  limit = 12,
  player?: { kind: 'base' | 'nft'; playerId: string },
): Promise<CtRecordItem[]> {
  const rows = player
    ? await prisma.$queryRaw<Array<CtRecordRow>>`
        SELECT "id", "playerKind", "playerId", "kind", "before", "after", "detail", "createdAt"
        FROM "CtRecord"
        WHERE "userId" = ${userId}
          AND "playerKind" = ${player.kind}
          AND "playerId" = ${player.playerId}
        ORDER BY "createdAt" DESC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<Array<CtRecordRow>>`
        SELECT "id", "playerKind", "playerId", "kind", "before", "after", "detail", "createdAt"
        FROM "CtRecord"
        WHERE "userId" = ${userId}
        ORDER BY "createdAt" DESC
        LIMIT ${limit}
      `;

  return rows.map(mapRow);
}

type CtRecordRow = {
  id: string;
  playerKind: string | null;
  playerId: string | null;
  kind: string;
  before: number | null;
  after: number | null;
  detail: string | null;
  createdAt: Date;
};

function mapRow(row: CtRecordRow): CtRecordItem {
  const kind = row.playerKind === 'base' || row.playerKind === 'nft' ? row.playerKind : null;
  return {
    id: row.id,
    playerKind: kind,
    playerId: row.playerId,
    kind: row.kind as CtRecordKind,
    before: row.before == null ? null : Number(row.before),
    after: row.after == null ? null : Number(row.after),
    detail: row.detail,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export async function applyTrainingEvolution(
  prisma: PrismaClient,
  userId: string,
  ref: { kind: 'base' | 'nft'; playerId: string },
  ctLvl: number,
  staminaCost: number,
): Promise<{ key: string; before: number; after: number } | null> {
  await writeCtRecord(prisma, {
    userId,
    playerKind: ref.kind,
    playerId: ref.playerId,
    kind: 'training',
    before: staminaCost,
    after: ctLvl,
    detail: 'activity',
  });

  const loaded = await loadPlayer(prisma, userId, ref);
  if (!loaded) return null;

  const current = readPlayerAttributes(loaded.attributes, ref.playerId, loaded.rarity, loaded.position);
  const step = evolveMainAttribute(current, loaded.position, loaded.rarity, ctLvl);
  if (step.after === step.before) {
    await writeCtRecord(prisma, {
      userId,
      playerKind: ref.kind,
      playerId: ref.playerId,
      kind: 'evolution',
      before: step.before,
      after: step.after,
      detail: step.key,
    });
    return step;
  }

  const next: PlayerAttributes = { ...current, [step.key]: step.after };
  if (ref.kind === 'base') {
    await prisma.basePlayer.update({
      where: { id: ref.playerId },
      data: { attributes: next as PrismaNs.InputJsonValue },
    });
  } else if (loaded.tokenId != null) {
    await prisma.playerCache.update({
      where: { tokenId: loaded.tokenId },
      data: { attributes: next as PrismaNs.InputJsonValue },
    });
  }

  await writeCtRecord(prisma, {
    userId,
    playerKind: ref.kind,
    playerId: ref.playerId,
    kind: 'evolution',
    before: step.before,
    after: step.after,
    detail: step.key,
  });
  return step;
}

async function loadPlayer(
  prisma: PrismaClient,
  userId: string,
  ref: { kind: 'base' | 'nft'; playerId: string },
): Promise<{ rarity: number; position: number; attributes: unknown; tokenId?: bigint } | null> {
  if (ref.kind === 'base') {
    if (typeof prisma.basePlayer?.findFirst !== 'function') return null;
    const player = await prisma.basePlayer.findFirst({
      where: { id: ref.playerId, userId },
      select: { rarity: true, position: true, attributes: true },
    });
    return player;
  }
  if (typeof prisma.playerCache?.findFirst !== 'function') return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { wallet: true } });
  const wallet = user?.wallet?.toLowerCase();
  if (!wallet) return null;
  let tokenId: bigint;
  try {
    tokenId = BigInt(ref.playerId);
  } catch {
    return null;
  }
  const player = await prisma.playerCache.findFirst({
    where: { tokenId, ownerWallet: wallet },
    select: { rarity: true, position: true, attributes: true, tokenId: true },
  });
  return player;
}
