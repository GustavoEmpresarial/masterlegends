import type { PrismaClient } from '@prisma/client';
import type {
  ClubRankingDTO,
  ClubRankingProfileDTO,
  PlayerRankingDTO,
  PublicStatsDTO,
  PublicWalletActivityDTO,
  RankingPlayerPreviewDTO,
} from '@mll/shared';
import {
  aggregateLineupPowerByUser,
  rolesFromSlots,
  mergeCheckInBonusIntoPower,
  mergeStadiumFarmBonusIntoPower,
  parseLineupAssignments,
  remapAssignmentsToDisplaySlots,
  isAwaySlot,
  stadiumSlotsSchema,
  sumActiveCheckInGrants,
  VESTIARIO_TEMPLATE_ID,
  type StadiumSlot,
} from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { RARITY_NAMES, POSITION_NAMES } from '../../config/game.js';
import { config } from '../../config/env.js';
import { maskWalletAddress } from './wallet-mask.js';

type PlayerPreviewInput = {
  id: string;
  name: string | null;
  overwall: number;
  position: number;
  rarity: number;
  imageUrl: string | null;
  kind: 'base' | 'nft';
};

function toPreview(p: PlayerPreviewInput): RankingPlayerPreviewDTO {
  return {
    id: p.id,
    name: p.name?.trim() || (POSITION_NAMES[p.position] ?? 'FW'),
    position: POSITION_NAMES[p.position] ?? 'FW',
    rarity: RARITY_NAMES[p.rarity] ?? 'common',
    overwall: p.overwall,
    imageUrl: p.imageUrl,
    kind: p.kind,
  };
}

function autoFillAssignments(
  slots: StadiumSlot[],
  players: RankingPlayerPreviewDTO[],
): Record<string, { playerId: string; kind: 'base' | 'nft' }> {
  const pools: Record<string, RankingPlayerPreviewDTO[]> = { GK: [], DEF: [], MID: [], FW: [] };
  for (const player of [...players].sort((a, b) => b.overwall - a.overwall)) {
    pools[player.position]?.push(player);
  }

  const used = new Set<string>();
  const assignments: Record<string, { playerId: string; kind: 'base' | 'nft' }> = {};

  for (const slot of slots) {
    if (slot.role === 'DECOR' || !slot.role) continue;
    const candidate = pools[slot.role]?.find((p) => !used.has(`${p.kind}:${p.id}`));
    if (!candidate) continue;
    used.add(`${candidate.kind}:${candidate.id}`);
    assignments[slot.id] = { playerId: candidate.id, kind: candidate.kind };
  }

  return assignments;
}

type LineupAssignment = { playerId: string; kind: 'base' | 'nft' };

export class StatsService {
  constructor(private readonly prisma: PrismaClient) {}

  async getPublicStats(): Promise<PublicStatsDTO> {
    const [registeredUsers, basePlayers, onChainPlayers, depositAgg, oldestUser] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.basePlayer.count(),
      this.prisma.playerCache.count(),
      this.prisma.walletTransaction.aggregate({
        where: { type: 'usdc_deposit', status: 'confirmed' },
        _sum: { amount: true },
      }),
      this.prisma.user.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    const nftsMinted = basePlayers + onChainPlayers;
    const totalDepositedUsd = Number(depositAgg._sum.amount ?? 0);

    const launchedAt =
      config.SITE_LAUNCHED_AT ??
      oldestUser?.createdAt.toISOString() ??
      new Date('2026-01-01T00:00:00.000Z').toISOString();

    return {
      registeredUsers,
      totalDepositedUsd,
      nftsMinted,
      launchedAt,
    };
  }

  async getPublicWalletActivity(): Promise<PublicWalletActivityDTO> {
    const select = {
      id: true,
      amount: true,
      txHash: true,
      createdAt: true,
      user: { select: { wallet: true } },
    } as const;

    const [depositRows, withdrawRows] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { type: 'usdc_deposit', status: 'confirmed' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select,
      }),
      this.prisma.walletTransaction.findMany({
        where: { type: 'usdc_withdraw', status: 'confirmed' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select,
      }),
    ]);

    const mapRow = (row: (typeof depositRows)[number]) => ({
      id: row.id,
      amountUsdc: Math.abs(Number(row.amount)),
      txHash: row.txHash,
      walletMasked: maskWalletAddress(row.user.wallet),
      createdAt: row.createdAt.toISOString(),
    });

    return {
      deposits: depositRows.map(mapRow),
      withdrawals: withdrawRows.map(mapRow),
    };
  }

  /**
   * Poder do posto dos titulares com stamina, na posição certa.
   * Com bônus, soma gear, estádio e check-in por cima (farm).
   * O ranking usa só o poder do posto.
   */
  private async loadLineupPowerByUser(includeBonuses = true): Promise<Map<string, number>> {
    const lineups = await this.prisma.clubLineup.findMany({
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
      const grants = await this.prisma.checkInGrant.findMany({
        where: { expiresAt: { gt: new Date() } },
        select: { userId: true, amount: true, expiresAt: true },
      });
      return sumActiveCheckInGrants(grants);
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

    const vest = await this.prisma.vestiarioTemplate.findFirst({
      where: { isDefault: true },
      select: { slots: true },
    });
    const slotRoles = rolesFromSlots(vest?.slots);

    const [basePlayers, nfts] = await Promise.all([
      baseIds.size > 0
        ? this.prisma.basePlayer.findMany({
            where: { id: { in: [...baseIds] }, userId: { in: [...userIds] } },
            select: { id: true, userId: true, overwall: true, stamina: true, position: true, rarity: true, attributes: true },
          })
        : Promise.resolve([]),
      nftTokenIds.size > 0 && walletsLower.size > 0
        ? this.prisma.playerCache.findMany({
            where: {
              tokenId: { in: [...nftTokenIds] },
              ownerWallet: { in: [...walletsLower] },
            },
            select: { tokenId: true, ownerWallet: true, overwall: true, stamina: true, position: true, rarity: true, attributes: true },
          })
        : Promise.resolve([]),
    ]);

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

    if (!includeBonuses) return lineupPower;

    // Add equipped gear OW for players currently in each lineup
    const equips = await this.prisma.playerGearEquip.findMany({
      include: { userGear: { include: { catalogItem: true } } },
    });
    const gearPctByPlayer = new Map<string, number>();
    for (const eq of equips) {
      const k = `${eq.userId}:${eq.playerKind}:${eq.playerId}`;
      gearPctByPlayer.set(k, (gearPctByPlayer.get(k) ?? 0) + eq.userGear.catalogItem.owBonus);
    }
    const baseOw = new Map(basePlayers.map((p) => [`${p.userId}:base:${p.id}`, p.overwall]));
    const nftOw = new Map(nfts.map((p) => [p.tokenId.toString(), p.overwall]));
    for (const row of lineups) {
      const userId = row.club.userId;
      const assignments = parseLineupAssignments(row.assignments);
      const seen = new Set<string>();
      let gearBonus = 0;
      for (const a of Object.values(assignments)) {
        const dedupe = `${a.kind}:${a.playerId}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        const pct = gearPctByPlayer.get(`${userId}:${a.kind}:${a.playerId}`) ?? 0;
        if (pct <= 0) continue;
        const ow = a.kind === 'base'
          ? baseOw.get(`${userId}:base:${a.playerId}`) ?? 0
          : nftOw.get(a.playerId) ?? 0;
        gearBonus += Math.floor(ow * pct / 100);
      }
      if (gearBonus > 0) {
        lineupPower.set(userId, (lineupPower.get(userId) ?? 0) + gearBonus);
      }
    }

    const withStadium = mergeStadiumFarmBonusIntoPower(lineupPower, farmBonusPctByUser);

    const grants = await this.prisma.checkInGrant.findMany({
      where: { expiresAt: { gt: new Date() } },
      select: { userId: true, amount: true, expiresAt: true },
    });
    const checkInBonus = sumActiveCheckInGrants(grants);
    return mergeCheckInBonusIntoPower(withStadium, checkInBonus);
  }

  private async computeClubRankings() {
    const clubs = await this.prisma.club.findMany({
      select: {
        name: true,
        stadiumLvl: true,
        userId: true,
        user: { select: { username: true, wallet: true } },
        lineup: {
          select: {
            stadiumTemplate: { select: { name: true, imageUrl: true } },
          },
        },
      },
    });

    if (clubs.length === 0) {
      return [];
    }

    const lineupPowerByUser = await this.loadLineupPowerByUser(false);

    return clubs
      .map((c) => {
        const lineupPower = lineupPowerByUser.get(c.userId) ?? 0;
        const stadium = c.lineup?.stadiumTemplate;
        return {
          clubName: c.name,
          username: c.user.username ?? '—',
          totalOverwall: lineupPower,
          stadiumLvl: c.stadiumLvl,
          stadiumName: stadium?.name ?? null,
          stadiumImageUrl: stadium?.imageUrl ?? null,
        };
      })
      .filter((c) => c.totalOverwall > 0)
      .sort((a, b) => b.totalOverwall - a.totalOverwall)
      .map((c, i) => ({ rank: i + 1, ...c }));
  }

  async getClubRanking(): Promise<ClubRankingDTO> {
    const ranked = await this.computeClubRankings();
    return { clubs: ranked.slice(0, 100) };
  }

  async getClubRankingProfile(clubName: string): Promise<ClubRankingProfileDTO> {
    const club = await this.prisma.club.findUnique({
      where: { name: decodeURIComponent(clubName) },
      select: {
        id: true,
        name: true,
        stadiumLvl: true,
        ctLvl: true,
        treasurerLvl: true,
        trophyRoomLvl: true,
        createdAt: true,
        userId: true,
        user: { select: { username: true, wallet: true } },
      },
    });

    if (!club) {
      throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    }

    const ranked = await this.computeClubRankings();
    const entry = ranked.find((c) => c.clubName === club.name);
    const wallet = club.user.wallet?.toLowerCase() ?? null;

    const [basePlayers, nfts, lineupRow, fallbackTemplate, vestiarioTemplate] = await Promise.all([
      this.prisma.basePlayer.findMany({
        where: { userId: club.userId },
        orderBy: { overwall: 'desc' },
        select: {
          id: true,
          name: true,
          overwall: true,
          position: true,
          rarity: true,
          imageUrl: true,
        },
      }),
      wallet
        ? this.prisma.playerCache.findMany({
            where: { ownerWallet: wallet },
            orderBy: { overwall: 'desc' },
            select: {
              tokenId: true,
              overwall: true,
              position: true,
              rarity: true,
            },
          })
        : Promise.resolve([]),
      this.prisma.clubLineup.findUnique({
        where: { clubId: club.id },
        include: { stadiumTemplate: true },
      }),
      this.prisma.stadiumTemplate.findFirst({
        where: { isDefault: true },
      }),
      this.prisma.vestiarioTemplate.findUnique({
        where: { id: VESTIARIO_TEMPLATE_ID },
      }),
    ]);

    const allPlayers: RankingPlayerPreviewDTO[] = [
      ...basePlayers.map((p) =>
        toPreview({ ...p, kind: 'base' }),
      ),
      ...nfts.map((p) =>
        toPreview({
          id: p.tokenId.toString(),
          name: `#${p.tokenId.toString().slice(0, 8)}`,
          overwall: p.overwall,
          position: p.position,
          rarity: p.rarity,
          imageUrl: null,
          kind: 'nft',
        }),
      ),
    ];

    const topPlayers = [...allPlayers].sort((a, b) => b.overwall - a.overwall).slice(0, 11);

    const templateRow =
      lineupRow?.stadiumTemplate ??
      fallbackTemplate ??
      (await this.prisma.stadiumTemplate.findFirst({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
      }));

    const playerByKey = new Map(allPlayers.map((p) => [`${p.kind}:${p.id}`, p]));

    let stadiumName = 'Campo';
    let stadiumImageUrl = '';
    let fieldSlots: ClubRankingProfileDTO['fieldSlots'] = [];

    if (templateRow) {
      const displaySlots = (stadiumSlotsSchema.parse(templateRow.slots) as StadiumSlot[]).filter(
        (slot) => !isAwaySlot(slot),
      );
      const vestiarioSlots = vestiarioTemplate
        ? (stadiumSlotsSchema.parse(vestiarioTemplate.slots) as StadiumSlot[])
        : displaySlots;
      stadiumName = templateRow.name;
      stadiumImageUrl = templateRow.imageUrl;

      const savedAssignments = lineupRow ? parseLineupAssignments(lineupRow.assignments) : {};
      const sourceAssignments =
        Object.keys(savedAssignments).length > 0
          ? savedAssignments
          : autoFillAssignments(displaySlots, allPlayers);
      const displayAssignments = remapAssignmentsToDisplaySlots(
        vestiarioSlots,
        displaySlots,
        sourceAssignments,
      );

      fieldSlots = displaySlots.map((slot) => {
        const assignment = displayAssignments[slot.id];
        const player = assignment
          ? (playerByKey.get(`${assignment.kind}:${assignment.playerId}`) ?? null)
          : null;
        return { slot, player };
      });
    }

    const seenField = new Set<string>();
    let fieldOverwall = 0;
    for (const { player } of fieldSlots) {
      if (!player) continue;
      const key = `${player.kind}:${player.id}`;
      if (seenField.has(key)) continue;
      seenField.add(key);
      fieldOverwall += player.overwall;
    }

    return {
      rank: entry?.rank ?? ranked.length + 1,
      clubName: club.name,
      username: club.user.username ?? '—',
      totalOverwall: entry?.totalOverwall ?? fieldOverwall,
      playerCount: allPlayers.length,
      stadiumLvl: club.stadiumLvl,
      ctLvl: club.ctLvl,
      treasurerLvl: club.treasurerLvl,
      trophyRoomLvl: club.trophyRoomLvl,
      createdAt: club.createdAt.toISOString(),
      stadiumName,
      stadiumImageUrl,
      fieldSlots,
      topPlayers,
    };
  }

  async getPlayerRanking(): Promise<PlayerRankingDTO> {
    const rows = await this.prisma.basePlayer.findMany({
      orderBy: { overwall: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        overwall: true,
        position: true,
        rarity: true,
        imageUrl: true,
        user: {
          select: {
            username: true,
            club: { select: { name: true } },
          },
        },
      },
    });

    return {
      players: rows.map((p, i) => ({
        rank: i + 1,
        playerName: p.name?.trim() || (POSITION_NAMES[p.position] ?? 'FW'),
        position: POSITION_NAMES[p.position] ?? 'FW',
        rarity: RARITY_NAMES[p.rarity] ?? 'common',
        overwall: p.overwall,
        imageUrl: p.imageUrl,
        clubName: p.user.club?.name ?? null,
        username: p.user.username,
      })),
    };
  }
}
