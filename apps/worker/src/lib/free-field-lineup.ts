import type { PrismaClient } from '@prisma/client';
import { parseLineupAssignments, staysOnFreeField, type LineupAssignment } from '@mll/shared';

type TrialRow = { kind: string; playerId: string; windowStartedAt: Date };

type TrialDb = PrismaClient & {
  playerFieldTrial?: {
    findMany: (args: unknown) => Promise<TrialRow[]>;
  };
};

function withoutExpiredFreeField(
  assignments: Record<string, LineupAssignment>,
  stakedKeys: Set<string>,
  windows: Map<string, string>,
  now: number,
): { assignments: Record<string, LineupAssignment>; changed: boolean } {
  const next: Record<string, LineupAssignment> = {};
  let changed = false;
  for (const [slotId, assignment] of Object.entries(assignments)) {
    const key = `${assignment.kind}:${assignment.playerId}`;
    const windowStartedAt = windows.get(key) ?? null;
    const keep =
      stakedKeys.has(key) || !windowStartedAt || staysOnFreeField(false, windowStartedAt, now);
    if (keep) next[slotId] = assignment;
    else changed = true;
  }
  return { assignments: changed ? next : assignments, changed };
}

/** Pull unstaked players off the pitch once their 5-minute window closes. */
export async function expireFreeFieldLineups(prisma: PrismaClient, now = new Date()): Promise<number> {
  const trialsApi = (prisma as TrialDb).playerFieldTrial;
  if (!trialsApi?.findMany || !prisma.playerStake?.findMany) return 0;

  const [trials, stakes, lineups] = await Promise.all([
    trialsApi.findMany({ select: { kind: true, playerId: true, windowStartedAt: true } }),
    prisma.playerStake.findMany({
      where: { status: 'active' },
      select: { kind: true, playerId: true },
    }),
    prisma.clubLineup.findMany({ select: { clubId: true, assignments: true } }),
  ]);

  const stakedKeys = new Set(stakes.map((row) => `${row.kind}:${row.playerId}`));
  const windows = new Map(
    trials.map((row) => [`${row.kind}:${row.playerId}`, row.windowStartedAt.toISOString()]),
  );
  if (windows.size === 0) return 0;

  let removed = 0;
  for (const lineup of lineups) {
    const assignments = parseLineupAssignments(lineup.assignments);
    const expired = withoutExpiredFreeField(assignments, stakedKeys, windows, now.getTime());
    if (!expired.changed) continue;
    removed += Object.keys(assignments).length - Object.keys(expired.assignments).length;
    await prisma.clubLineup.update({
      where: { clubId: lineup.clubId },
      data: { assignments: expired.assignments },
    });
  }
  return removed;
}
