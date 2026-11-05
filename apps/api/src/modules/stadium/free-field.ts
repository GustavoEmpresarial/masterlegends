import type { PrismaClient } from '@prisma/client';
import type { LineupAssignment } from '@mll/shared';
import { freeFieldStatus, staysOnFreeField, type FreeFieldWindowDTO } from '@mll/shared';

type TrialClient = PrismaClient & {
  playerFieldTrial?: {
    findMany: (args: unknown) => Promise<Array<{ kind: string; playerId: string; windowStartedAt: Date }>>;
    upsert?: (args: unknown) => Promise<unknown>;
  };
};

export async function loadFieldTrialWindows(
  prisma: PrismaClient,
  userId: string,
): Promise<Map<string, string>> {
  const trials = (prisma as TrialClient).playerFieldTrial;
  if (!trials?.findMany) return new Map();
  const rows = await trials.findMany({
    where: { userId },
    select: { kind: true, playerId: true, windowStartedAt: true },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(`${row.kind}:${row.playerId}`, row.windowStartedAt.toISOString());
  }
  return map;
}

export function fieldWindowFor(
  staked: boolean,
  windows: Map<string, string> | null,
  key: string,
  now = Date.now(),
): FreeFieldWindowDTO {
  return freeFieldStatus({
    staked,
    windowStartedAt: staked ? null : windows?.get(key) ?? null,
    now,
  });
}

export async function startFieldTrial(
  prisma: PrismaClient,
  userId: string,
  kind: 'base' | 'nft',
  playerId: string,
  now = new Date(),
): Promise<void> {
  const trials = (prisma as TrialClient).playerFieldTrial;
  if (!trials?.upsert) return;
  await trials.upsert({
    where: { kind_playerId: { kind, playerId } },
    create: { userId, kind, playerId, windowStartedAt: now },
    update: { userId, windowStartedAt: now },
  });
}

/**
 * Drop unstaked players whose 5-minute window already closed.
 * Players with no window stay: stake is what put them on the pitch.
 */
export function withoutExpiredFreeField(
  assignments: Record<string, LineupAssignment>,
  stakedKeys: Set<string>,
  windows: Map<string, string>,
  now = Date.now(),
): { assignments: Record<string, LineupAssignment>; changed: boolean } {
  const next: Record<string, LineupAssignment> = {};
  let changed = false;
  for (const [slotId, assignment] of Object.entries(assignments)) {
    const key = `${assignment.kind}:${assignment.playerId}`;
    const windowStartedAt = windows.get(key) ?? null;
    const keep =
      stakedKeys.has(key) ||
      !windowStartedAt ||
      staysOnFreeField(false, windowStartedAt, now);
    if (keep) next[slotId] = assignment;
    else changed = true;
  }
  return { assignments: changed ? next : assignments, changed };
}
