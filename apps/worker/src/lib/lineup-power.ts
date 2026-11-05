import type { PrismaClient } from '@prisma/client';
import {
  aggregateLineupPowerByUser,
  mergeCheckInBonusIntoPower,
  mergeStadiumFarmBonusIntoPower,
  rolesFromSlots,
  sumActiveCheckInGrants,
} from '@mll/shared';
import { parseLineupAssignments } from '@mll/shared';
import { expireFreeFieldLineups } from './free-field-lineup.js';

/** Check-in presença + Overwall temporário de quests (EventOverwallGrant). */
async function loadTemporaryOverwallBonusByUser(prisma: PrismaClient): Promise<Map<string, number>> {
  const now = new Date();
  const [checkInGrants, eventGrants] = await Promise.all([
    prisma.checkInGrant.findMany({
      where: { expiresAt: { gt: now } },
      select: { userId: true, amount: true, expiresAt: true },
    }),
    prisma.eventOverwallGrant.findMany({
      where: { expiresAt: { gt: now } },
      select: { userId: true, amount: true, expiresAt: true },
    }),
  ]);
  const map = sumActiveCheckInGrants(checkInGrants, now);
  for (const row of eventGrants) {
    if (row.expiresAt <= now) continue;
    map.set(row.userId, (map.get(row.userId) ?? 0) + row.amount);
  }
  return map;
}

/** Equipped gear as a percent of that player's overwall, only if they are in the lineup. */
async function loadLineupGearBonusByUser(
  prisma: PrismaClient,
  lineups: Array<{
    assignments: unknown;
    club: { userId: string };
  }>,
  overwallByPlayer: Map<string, number>,
): Promise<Map<string, number>> {
  const userIds = [...new Set(lineups.map((r) => r.club.userId))];
  if (userIds.length === 0) return new Map();

  const lineupKeysByUser = new Map<string, Set<string>>();
  for (const row of lineups) {
    const keys = new Set<string>();
    const assignments = parseLineupAssignments(row.assignments);
    for (const assignment of Object.values(assignments)) {
      keys.add(`${assignment.kind}:${assignment.playerId}`);
    }
    lineupKeysByUser.set(row.club.userId, keys);
  }

  const equips = await prisma.playerGearEquip.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      playerId: true,
      playerKind: true,
      userGear: { select: { catalogItem: { select: { owBonus: true } } } },
    },
  });

  const pctByPlayer = new Map<string, number>();
  for (const eq of equips) {
    const key = `${eq.playerKind}:${eq.playerId}`;
    if (!lineupKeysByUser.get(eq.userId)?.has(key)) continue;
    const pct = eq.userGear.catalogItem.owBonus;
    if (pct <= 0) continue;
    const id = `${eq.userId}:${key}`;
    pctByPlayer.set(id, (pctByPlayer.get(id) ?? 0) + pct);
  }

  const bonusByUser = new Map<string, number>();
  for (const [id, pct] of pctByPlayer) {
    const ow = overwallByPlayer.get(id) ?? 0;
    const bonus = Math.floor(ow * pct / 100);
    if (bonus <= 0) continue;
    const userId = id.slice(0, id.indexOf(':'));
    bonusByUser.set(userId, (bonusByUser.get(userId) ?? 0) + bonus);
  }
  return bonusByUser;
}

function mergeGearBonusIntoPower(
  powerByUser: Map<string, number>,
  gearBonusByUser: Map<string, number>,
): Map<string, number> {
  if (gearBonusByUser.size === 0) return powerByUser;
  const merged = new Map(powerByUser);
  for (const [userId, bonus] of gearBonusByUser) {
    if (bonus <= 0) continue;
    const base = merged.get(userId) ?? 0;
    // Only boost users who already have lineup power (escalados).
    if (base <= 0) continue;
    merged.set(userId, base + bonus);
  }
  return merged;
}

export async function loadLineupPowerByUser(prisma: PrismaClient): Promise<Map<string, number>> {
  await expireFreeFieldLineups(prisma);
  const lineups = await prisma.clubLineup.findMany({
    include: {
      stadiumTemplate: { select: { farmBonusPct: true } },
      club: {
        select: {
          userId: true,
          user: { select: { wallet: true } },
        },
      },
    },
  });

  if (lineups.length === 0) {
    return loadTemporaryOverwallBonusByUser(prisma);
  }

  const baseIds = new Set<string>();
  const nftTokenIds = new Set<bigint>();
  const userIds = new Set<string>();
  const walletsLower = new Set<string>();
  const farmBonusPctByUser = new Map<string, number>();

  for (const row of lineups) {
    userIds.add(row.club.userId);
    const wallet = row.club.user?.wallet?.toLowerCase() ?? null;
    if (wallet) walletsLower.add(wallet);
    const pct = Number(row.stadiumTemplate?.farmBonusPct ?? 0);
    if (pct > 0) farmBonusPctByUser.set(row.club.userId, pct);

    const assignments = parseLineupAssignments(row.assignments);
    for (const assignment of Object.values(assignments)) {
      if (assignment.kind === 'base') {
        baseIds.add(assignment.playerId);
      } else if (wallet) {
        try {
          nftTokenIds.add(BigInt(assignment.playerId));
        } catch {
          // ignore invalid token id in saved lineup
        }
      }
    }
  }

  const vest = await prisma.vestiarioTemplate.findFirst({
    where: { isDefault: true },
    select: { slots: true },
  });
  const slotRoles = rolesFromSlots(vest?.slots);

  const [basePlayers, nfts] = await Promise.all([
    baseIds.size > 0
      ? prisma.basePlayer.findMany({
          where: { id: { in: [...baseIds] }, userId: { in: [...userIds] } },
          select: { id: true, userId: true, overwall: true, stamina: true, position: true, rarity: true, attributes: true },
        })
      : Promise.resolve([]),
    nftTokenIds.size > 0 && walletsLower.size > 0
      ? prisma.playerCache.findMany({
          where: {
            tokenId: { in: [...nftTokenIds] },
            ownerWallet: { in: [...walletsLower] },
          },
          select: { tokenId: true, ownerWallet: true, overwall: true, stamina: true, position: true, rarity: true, attributes: true },
        })
      : Promise.resolve([]),
  ]);

  const overwallByPlayer = new Map<string, number>();
  for (const player of basePlayers) {
    overwallByPlayer.set(`${player.userId}:base:${player.id}`, player.overwall);
  }
  for (const nft of nfts) {
    const lineup = lineups.find((row) => row.club.user?.wallet?.toLowerCase() === nft.ownerWallet.toLowerCase());
    if (!lineup) continue;
    overwallByPlayer.set(`${lineup.club.userId}:nft:${nft.tokenId.toString()}`, nft.overwall);
  }
  const gearBonusByUser = await loadLineupGearBonusByUser(prisma, lineups, overwallByPlayer);

  const lineupPower = aggregateLineupPowerByUser(
    lineups.map((row) => ({
      assignments: row.assignments,
      club: {
        userId: row.club.userId,
        user: row.club.user
          ? { wallet: row.club.user.wallet?.toLowerCase() ?? null }
          : null,
      },
    })),
    basePlayers,
    nfts.map((nft) => ({
      tokenId: nft.tokenId,
      ownerWallet: nft.ownerWallet.toLowerCase(),
      overwall: nft.overwall,
      stamina: nft.stamina,
      position: nft.position,
      rarity: nft.rarity,
      attributes: nft.attributes,
    })),
    slotRoles,
  );

  const withGear = mergeGearBonusIntoPower(lineupPower, gearBonusByUser);
  const withStadium = mergeStadiumFarmBonusIntoPower(withGear, farmBonusPctByUser);
  const tempOwBonus = await loadTemporaryOverwallBonusByUser(prisma);
  return mergeCheckInBonusIntoPower(withStadium, tempOwBonus);
}
