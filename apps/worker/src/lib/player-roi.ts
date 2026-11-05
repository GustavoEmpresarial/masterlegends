import type { Prisma } from '@prisma/client';
import {
  parseLineupAssignments,
  PLAYER_ROI_RETIRE_MULTIPLIER,
  type LineupAssignment,
} from '@mll/shared';

type Tx = Prisma.TransactionClient;

/**
 * Attribute net mining USDC to paid BasePlayers on the XI by overwall share,
 * then retire any that hit 200% ROI (strip from lineup).
 */
export async function attributeMiningRoiAndRetire(
  tx: Tx,
  userId: string,
  netUsdc: number,
  lineupPower: number,
): Promise<void> {
  if (!(netUsdc > 0) || !(lineupPower > 0)) return;

  const club = await tx.club.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!club) return;

  const lineup = await tx.clubLineup.findUnique({
    where: { clubId: club.id },
    select: { assignments: true },
  });
  if (!lineup) return;

  const assignments = parseLineupAssignments(lineup.assignments);
  const baseIds = [
    ...new Set(
      Object.values(assignments)
        .filter((a) => a.kind === 'base')
        .map((a) => a.playerId),
    ),
  ];
  if (baseIds.length === 0) return;

  const players = await tx.basePlayer.findMany({
    where: {
      id: { in: baseIds },
      userId,
      retiredAt: null,
      costBasisUsdc: { gt: 0 },
    },
    select: {
      id: true,
      overwall: true,
      costBasisUsdc: true,
      lifetimeEarnedUsdc: true,
    },
  });
  if (players.length === 0) return;

  const now = new Date();
  const retiredIds: string[] = [];

  for (const player of players) {
    const cost = Number(player.costBasisUsdc);
    if (!(cost > 0) || player.overwall <= 0) continue;

    const share = player.overwall / lineupPower;
    const delta = netUsdc * share;
    if (!(delta > 0)) continue;

    const prevEarned = Number(player.lifetimeEarnedUsdc);
    const nextEarned = prevEarned + delta;
    const retireThreshold = cost * PLAYER_ROI_RETIRE_MULTIPLIER;
    const shouldRetire = nextEarned + 1e-12 >= retireThreshold;

    await tx.basePlayer.update({
      where: { id: player.id },
      data: {
        lifetimeEarnedUsdc: nextEarned,
        ...(shouldRetire ? { retiredAt: now } : {}),
      },
    });

    if (shouldRetire) retiredIds.push(player.id);
  }

  if (retiredIds.length === 0) return;

  const retiredSet = new Set(retiredIds);
  const nextAssignments: Record<string, LineupAssignment> = {};
  for (const [slotId, assignment] of Object.entries(assignments)) {
    if (assignment.kind === 'base' && retiredSet.has(assignment.playerId)) continue;
    nextAssignments[slotId] = assignment;
  }

  await tx.clubLineup.update({
    where: { clubId: club.id },
    data: { assignments: nextAssignments },
  });
}
