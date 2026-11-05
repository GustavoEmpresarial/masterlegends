import type { PrismaClient } from '@prisma/client';
import type { Building, CreateClubInput } from '@mll/shared';
import { parseLineupAssignments, playerAgeFromRoi, readPlayerAttributes, resolvePlayerDisplayName, stakeGmtForRarityIndex } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import type { JobQueues } from '../../common/lib/queues.js';
import {
  GAME_CONFIG,
  calculateUpgradeCost,
  POSITION_NAMES,
  RARITY_NAMES,
} from '../../config/game.js';
import { STAMINA_MAX } from '../../common/lib/stamina.js';
import { MiningService } from '../mining/mining.service.js';
import { loadActiveStakes } from '../player-stake/player-stake.service.js';
import { fieldWindowFor, loadFieldTrialWindows } from '../stadium/free-field.js';
import { StaminaService } from '../stamina/stamina.service.js';
import { writeCtRecord } from '../ct/ct-record.js';
import { ClubRepository } from './club.repository.js';

export class ClubService {
  private readonly miningService: MiningService;

  constructor(
    private readonly repo: ClubRepository,
    private readonly staminaService: StaminaService,
    private readonly prisma: PrismaClient,
    private readonly queues?: JobQueues,
    redis?: { exists(key: string): Promise<number> },
  ) {
    this.miningService = new MiningService(prisma, redis);
  }

  private async getSponsorshipMetrics(userId: string) {
    try {
      const summary = await this.miningService.getSummary(userId);
      const intervalMin = Math.max(1, summary.blockIntervalMin);
      const estimatedUsdcPerRound = summary.paused ? 0 : summary.estimatedPerBlock;
      const usdcPerHour = estimatedUsdcPerRound * (60 / intervalMin);
      return {
        lineupOverwall: summary.currentOverwall,
        playersBaseOverwall: summary.playersBaseOverwall,
        estimatedUsdcPerRound,
        usdcPerHour,
        sharePct: summary.sharePct,
        pendingFarmUsdc: 0,
        stadiumWatching: summary.stadiumWatching,
        presenceRate: summary.presenceRate,
      };
    } catch {
      // Patrocínio é decorativo no /api/club — falha aqui não pode derrubar o clube.
      return {
        lineupOverwall: 0,
        playersBaseOverwall: 0,
        estimatedUsdcPerRound: 0,
        usdcPerHour: 0,
        sharePct: 0,
        pendingFarmUsdc: 0,
        stadiumWatching: false,
        presenceRate: 0.7,
      };
    }
  }

  /**
   * Retorna o estado completo do clube: saldo MGT, inventário, métricas de patrocínios.
   */
  async getClub(userId: string) {
    const club = await this.repo.findByUserId(userId);
    if (!club) {
      throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    }

    const balance = await this.repo.getMgtBalance(userId);
    const wallet = club.user?.wallet ?? null;
    const { nfts, basePlayers } = await this.repo.getInventory(userId, wallet);
    const sponsorship = await this.getSponsorshipMetrics(userId);

    const retired = await this.prisma.basePlayer.aggregate({
      where: { userId, retiredAt: { not: null } },
      _sum: { overwall: true },
    });
    const squadOverwall =
      basePlayers.filter((p) => !p.listed).reduce((sum, p) => sum + p.overwall, 0) +
      nfts.reduce((sum, p) => sum + p.overwall, 0);
    const collectionOverwall =
      basePlayers.reduce((sum, p) => sum + p.overwall, 0) +
      nfts.reduce((sum, p) => sum + p.overwall, 0) +
      (retired._sum.overwall ?? 0);

    const { user: _user, ...clubData } = club;
    return {
      ...clubData,
      squadOverwall,
      activeOverwall: sponsorship.playersBaseOverwall,
      collectionOverwall,
      gmtBalance: Number(balance?.amount ?? 0),
      usdcBalance: Number(balance?.usdcAmount ?? 0),
      usdtBalance: Number(balance?.usdtAmount ?? 0),
      nftCount: nfts.length,
      basePlayerCount: basePlayers.length,
      lineupOverwall: sponsorship.lineupOverwall,
      estimatedUsdcPerRound: sponsorship.estimatedUsdcPerRound,
      usdcPerHour: sponsorship.usdcPerHour,
      sharePct: sponsorship.sharePct,
      pendingFarmUsdc: 0,
      stadiumWatching: sponsorship.stadiumWatching,
      presenceRate: sponsorship.presenceRate,
    };
  }

  async createClub(userId: string, input: CreateClubInput) {
    const existing = await this.repo.findByUserId(userId);
    if (existing) {
      throw new AppError(ErrorCode.CLUB_ALREADY_EXISTS, 400);
    }
    const taken = await this.repo.findByName(input.name);
    if (taken) {
      throw new AppError(ErrorCode.CLUB_NAME_TAKEN, 400);
    }
    await this.repo.create(userId, input.name);
    return this.getClub(userId);
  }

  async getMgtBalance(userId: string): Promise<number> {
    const balance = await this.repo.getMgtBalance(userId);
    return Number(balance?.amount ?? 0);
  }

  async getInventory(userId: string) {
    await this.staminaService.syncDrift(userId);
    const club = await this.repo.findByUserId(userId);
    if (!club) {
      throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    }
    const wallet = club.user?.wallet ?? null;
    const { nfts, basePlayers } = await this.repo.getInventory(userId, wallet);
    const stakes = await loadActiveStakes(this.prisma, userId);
    const trials = await loadFieldTrialWindows(this.prisma, userId);

    const lineupRow = await this.prisma.clubLineup.findUnique({ where: { clubId: club.id } });
    const assignments = lineupRow ? parseLineupAssignments(lineupRow.assignments) : {};
    const lineupBaseIds = new Set(
      Object.values(assignments)
        .filter((a) => a.kind === 'base')
        .map((a) => a.playerId),
    );

    const equips = await this.prisma.playerGearEquip.findMany({
      where: { userId },
      include: { userGear: { include: { catalogItem: true } } },
    });
    const gearByPlayer = new Map<
      string,
      {
        slot: string;
        userGearId: string;
        nameKey: string;
        rarity: number;
        owBonus: number;
        imageUrl: string | null;
      }[]
    >();
    for (const eq of equips) {
      const key = `${eq.playerKind}:${eq.playerId}`;
      const list = gearByPlayer.get(key) ?? [];
      list.push({
        slot: eq.slot,
        userGearId: eq.userGearId,
        nameKey: eq.userGear.catalogItem.nameKey,
        rarity: eq.userGear.catalogItem.rarity,
        owBonus: eq.userGear.catalogItem.owBonus,
        imageUrl: eq.userGear.catalogItem.imageUrl,
      });
      gearByPlayer.set(key, list);
    }

    const players = [
      ...basePlayers.map((p) => {
        const equippedGear = gearByPlayer.get(`base:${p.id}`) ?? [];
        const gearPct = equippedGear.reduce((s, g) => s + g.owBonus, 0);
        const gearBonus = Math.floor(p.overwall * gearPct / 100);
        const costBasisUsdc = Number(p.costBasisUsdc ?? 0);
        const lifetimeEarnedUsdc = Number(p.lifetimeEarnedUsdc ?? 0);
        const career = playerAgeFromRoi(costBasisUsdc, lifetimeEarnedUsdc);
        return {
          id: p.id,
          rarity: RARITY_NAMES[p.rarity] ?? 'common',
          overwall: p.overwall,
          effectiveOverwall: p.overwall + gearBonus,
          equippedGear,
          position: POSITION_NAMES[p.position] ?? 'FW',
          listed: p.listed,
          inLineup: lineupBaseIds.has(p.id),
          kind: 'base' as const,
          name: resolvePlayerDisplayName(p.name ?? p.template?.name, p.id),
          imageUrl: p.imageUrl ?? p.template?.imageUrl ?? null,
          stamina: p.stamina,
          staminaMax: STAMINA_MAX,
          createdAt: p.createdAt.toISOString(),
          source: p.source,
          fieldedAt: p.fieldedAt?.toISOString() ?? null,
          expiresAt: p.expiresAt?.toISOString() ?? null,
          costBasisUsdc,
          lifetimeEarnedUsdc,
          age: career.age,
          retireAge: career.retireAge,
          roiPct: career.roiPct,
          retiredAt: null,
          staked: stakes.has(`base:${p.id}`),
          stakedAt: stakes.get(`base:${p.id}`)?.stakedAt ?? null,
          stakeGmt: stakeGmtForRarityIndex(p.rarity),
          freeField: fieldWindowFor(stakes.has(`base:${p.id}`), trials, `base:${p.id}`),
          attributes: readPlayerAttributes(p.attributes, p.id, p.rarity, p.position),
        };
      }),
      ...nfts.map((p) => {
        const id = p.tokenId.toString();
        const equippedGear = gearByPlayer.get(`nft:${id}`) ?? [];
        const gearPct = equippedGear.reduce((s, g) => s + g.owBonus, 0);
        const gearBonus = Math.floor(p.overwall * gearPct / 100);
        return {
          id,
          tokenId: id,
          rarity: RARITY_NAMES[p.rarity] ?? 'common',
          overwall: p.overwall,
          effectiveOverwall: p.overwall + gearBonus,
          equippedGear,
          position: POSITION_NAMES[p.position] ?? 'FW',
          listed: false,
          kind: 'nft' as const,
          stamina: p.stamina,
          staminaMax: STAMINA_MAX,
          createdAt: p.createdAt.toISOString(),
          staked: stakes.has(`nft:${id}`),
          stakedAt: stakes.get(`nft:${id}`)?.stakedAt ?? null,
          stakeGmt: stakeGmtForRarityIndex(p.rarity),
          freeField: fieldWindowFor(stakes.has(`nft:${id}`), trials, `nft:${id}`),
          attributes: readPlayerAttributes(p.attributes, id, p.rarity, p.position),
        };
      }),
    ].sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      if (bTime !== aTime) return bTime - aTime;
      return (b.effectiveOverwall ?? b.overwall) - (a.effectiveOverwall ?? a.overwall);
    });

    return {
      players,
      totalPlayers: players.length,
    };
  }

  async upgradeBuilding(userId: string, building: Building) {
    const club = await this.repo.findByUserId(userId);
    if (!club) {
      throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    }

    const currentLevel = (club as unknown as Record<string, number>)[`${building}Lvl`];
    if (typeof currentLevel !== 'number') {
      throw new AppError(ErrorCode.CLUB_INVALID_BUILDING, 400);
    }
    if (currentLevel >= GAME_CONFIG.MAX_BUILDING_LEVEL) {
      throw new AppError(ErrorCode.CLUB_MAX_LEVEL_REACHED, 400);
    }

    const cost = calculateUpgradeCost(currentLevel);

    const balance = await this.repo.getMgtBalance(userId);
    const current = Number(balance?.amount ?? 0);
    if (!balance || current < cost) {
      throw new AppError(ErrorCode.INSUFFICIENT_USDC, 400, { required: cost, current });
    }

    const newLevel = currentLevel + 1;
    await this.repo.upgradeBuildingTx(userId, club.id, building, cost, newLevel);

    if (building === 'ct') {
      await writeCtRecord(this.prisma, {
        userId,
        kind: 'progression',
        before: currentLevel,
        after: newLevel,
        detail: 'ct',
      });
    }

    return { building, newLevel, cost, ...(await this.getClub(userId)) };
  }
}
