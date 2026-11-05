import { fieldRole, positionPower, readPlayerAttributes } from '../economy/attributes.js';
import { parseLineupAssignments } from '../schemas/stadium.js';

export interface LineupPowerRow {
  assignments: unknown;
  club: {
    userId: string;
    user?: { wallet: string | null } | null;
  };
}

export interface LineupBasePlayerPower {
  id: string;
  userId: string;
  overwall: number;
  stamina?: number;
  position?: number;
  rarity?: number;
  attributes?: unknown;
}

export interface LineupNftPlayerPower {
  tokenId: bigint;
  ownerWallet: string;
  overwall: number;
  stamina?: number;
  position?: number;
  rarity?: number;
  attributes?: unknown;
}

/**
 * Soma overwall apenas dos jogadores escalados no estádio (lineup salva).
 * Jogadores no elenco/reserva não entram no cálculo de patrocínios.
 */
function activeContribution(player: {
  id: string;
  overwall: number;
  stamina?: number;
  position?: number;
  rarity?: number;
  attributes?: unknown;
  slotRole?: string;
}): number | null {
  if (player.stamina != null && player.stamina <= 0) return null;
  if (player.slotRole && player.position != null && fieldRole(player.position) !== fieldRole(player.slotRole)) {
    return null;
  }
  if (player.position == null || player.rarity == null) return player.overwall;
  const attributes = readPlayerAttributes(player.attributes, player.id, player.rarity, player.position);
  return positionPower(attributes, player.position);
}

export function aggregateLineupPowerByUser(
  lineups: LineupPowerRow[],
  basePlayers: LineupBasePlayerPower[],
  nfts: LineupNftPlayerPower[],
  slotRoles: Record<string, string | undefined> = {},
): Map<string, number> {
  const baseMap = new Map<string, LineupBasePlayerPower>();
  for (const player of basePlayers) {
    baseMap.set(`${player.userId}:${player.id}`, player);
  }

  const nftMap = new Map<string, LineupNftPlayerPower>();
  for (const player of nfts) {
    nftMap.set(`${player.ownerWallet.toLowerCase()}:${player.tokenId.toString()}`, player);
  }

  const powerByUser = new Map<string, number>();

  for (const row of lineups) {
    const userId = row.club.userId;
    const wallet = row.club.user?.wallet?.toLowerCase() ?? null;
    const assignments = parseLineupAssignments(row.assignments);
    const seen = new Set<string>();
    let power = 0;

    for (const [slotId, assignment] of Object.entries(assignments)) {
      const dedupeKey = `${assignment.kind}:${assignment.playerId}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const slotRole = slotRoles[slotId];
      if (assignment.kind === 'base') {
        const player = baseMap.get(`${userId}:${assignment.playerId}`);
        if (!player) continue;
        const contribution = activeContribution({ ...player, slotRole });
        if (contribution != null) power += contribution;
      } else if (wallet) {
        const player = nftMap.get(`${wallet}:${assignment.playerId}`);
        if (!player) continue;
        const contribution = activeContribution({
          id: player.tokenId.toString(),
          overwall: player.overwall,
          stamina: player.stamina,
          position: player.position,
          rarity: player.rarity,
          attributes: player.attributes,
          slotRole,
        });
        if (contribution != null) power += contribution;
      }
    }

    if (power > 0) {
      powerByUser.set(userId, power);
    }
  }

  return powerByUser;
}

export function rolesFromSlots(slots: unknown): Record<string, string> {
  if (!Array.isArray(slots)) return {};
  const map: Record<string, string> = {};
  for (const slot of slots) {
    if (!slot || typeof slot !== 'object') continue;
    const row = slot as { id?: unknown; role?: unknown };
    if (row.id == null || row.role == null) continue;
    map[String(row.id)] = String(row.role);
  }
  return map;
}

/** OW extra do bônus de farm do estádio ativo (ex.: 0.02 → +2% sobre a escalação). */
export function stadiumFarmBonusOverwall(lineupOverwall: number, farmBonusPct: number): number {
  if (!(lineupOverwall > 0) || !(farmBonusPct > 0)) return 0;
  return Math.floor(lineupOverwall * farmBonusPct);
}

/**
 * Aplica farmBonusPct do estádio ativo sobre o poder de escalação (já com gear).
 * farmBonusPctByUser: userId → fração (0.02 = 2%).
 */
export function mergeStadiumFarmBonusIntoPower(
  powerByUser: Map<string, number>,
  farmBonusPctByUser: Map<string, number>,
): Map<string, number> {
  if (farmBonusPctByUser.size === 0) return powerByUser;
  const merged = new Map(powerByUser);
  for (const [userId, pct] of farmBonusPctByUser) {
    const base = merged.get(userId) ?? 0;
    const bonus = stadiumFarmBonusOverwall(base, pct);
    if (bonus <= 0) continue;
    merged.set(userId, base + bonus);
  }
  return merged;
}
