import type { PrismaClient } from '@prisma/client';
import type { DailyRestResultDTO, InventoryPlayerDTO, VestiarioViewDTO } from '@mll/shared';
import type { LineupAssignment } from '@mll/shared';
import { playerAgeFromRoi, positionPower, readPlayerAttributes, resolvePlayerDisplayName, stakeGmtForRarityIndex, type FreeFieldWindowDTO } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import {
  STAMINA_MAX,
  canClaimDailyRest,
  nextRestAvailableAt,
  passiveRecoveryPerHour,
} from '../../common/lib/stamina.js';
import { POSITION_NAMES, RARITY_NAMES } from '../../config/game.js';
import { AfflictionService } from '../afflictions/affliction.service.js';
import { ClubRepository } from '../club/club.repository.js';
import { getCoachStaminaRecoveryPerHour } from '../office/office-config.js';
import { loadActiveStakes } from '../player-stake/player-stake.service.js';
import { StadiumPlayerService } from '../stadium/stadium-player.service.js';
import { StaminaService } from '../stamina/stamina.service.js';
import { getStaminaRules } from '../stamina/stamina-rules.js';
import { fieldWindowFor, loadFieldTrialWindows } from '../stadium/free-field.js';

function mapBenchPlayer(
  p: {
    id: string;
    rarity: number;
    overwall: number;
    position: number;
    listed: boolean;
    name: string | null;
    imageUrl: string | null;
    stamina: number;
    createdAt: Date;
    attributes?: unknown;
    costBasisUsdc?: { toString(): string } | number;
    lifetimeEarnedUsdc?: { toString(): string } | number;
  },
  staked: boolean,
  stakedAt?: string | null,
  freeField?: FreeFieldWindowDTO,
): InventoryPlayerDTO {
  const stamina = p.stamina;
  const costBasisUsdc = Number(p.costBasisUsdc ?? 0);
  const lifetimeEarnedUsdc = Number(p.lifetimeEarnedUsdc ?? 0);
  const career = playerAgeFromRoi(costBasisUsdc, lifetimeEarnedUsdc);
  const attributes = readPlayerAttributes(p.attributes, p.id, p.rarity, p.position);
  return {
    id: p.id,
    kind: 'base',
    rarity: RARITY_NAMES[p.rarity] ?? 'common',
    overwall: p.overwall,
    positionPower: positionPower(attributes, p.position),
    position: POSITION_NAMES[p.position] ?? 'FW',
    listed: p.listed,
    name: resolvePlayerDisplayName(p.name, p.id),
    imageUrl: p.imageUrl,
    stamina,
    staminaMax: STAMINA_MAX,
    createdAt: p.createdAt.toISOString(),
    costBasisUsdc,
    lifetimeEarnedUsdc,
    age: career.hasCareerCycle ? career.age : undefined,
    retireAge: career.hasCareerCycle ? career.retireAge : undefined,
    roiPct: career.hasCareerCycle ? career.roiPct : undefined,
    staked,
    stakedAt: staked ? stakedAt ?? null : null,
    stakeGmt: stakeGmtForRarityIndex(p.rarity),
    freeField,
  };
}

function mapBenchNft(
  p: {
    tokenId: bigint;
    rarity: number;
    overwall: number;
    position: number;
    stamina: number;
    createdAt: Date;
    attributes?: unknown;
  },
  staked: boolean,
  stakedAt?: string | null,
  freeField?: FreeFieldWindowDTO,
): InventoryPlayerDTO {
  const id = p.tokenId.toString();
  const stamina = p.stamina;
  const attributes = readPlayerAttributes(p.attributes, id, p.rarity, p.position);
  return {
    id,
    tokenId: id,
    kind: 'nft',
    rarity: RARITY_NAMES[p.rarity] ?? 'common',
    overwall: p.overwall,
    positionPower: positionPower(attributes, p.position),
    position: POSITION_NAMES[p.position] ?? 'FW',
    listed: false,
    stamina,
    staminaMax: STAMINA_MAX,
    createdAt: p.createdAt.toISOString(),
    staked,
    stakedAt: staked ? stakedAt ?? null : null,
    stakeGmt: stakeGmtForRarityIndex(p.rarity),
    freeField,
  };
}

export class VestiarioService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clubRepo: ClubRepository,
    private readonly stadiumPlayer: StadiumPlayerService,
    private readonly staminaService: StaminaService,
  ) {}

  async getView(userId: string): Promise<VestiarioViewDTO> {
    await this.staminaService.syncDrift(userId);
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const view = await this.stadiumPlayer.getVestiarioView(userId);
    const wallet = club.user?.wallet ?? null;
    const { nfts, basePlayers } = await this.clubRepo.getInventory(userId, wallet);

    const assignedKeys = new Set(
      Object.values(view.assignments).map((a) => `${a.kind}:${a.playerId}`),
    );
    const stakes = await loadActiveStakes(this.prisma, userId);
    const trials = await loadFieldTrialWindows(this.prisma, userId);

    const bench: InventoryPlayerDTO[] = [
      ...basePlayers
        .filter((p) => !assignedKeys.has(`base:${p.id}`))
        .map((p) => {
          const stake = stakes.get(`base:${p.id}`);
          const key = `base:${p.id}`;
          return mapBenchPlayer(
            p,
            Boolean(stake),
            stake?.stakedAt,
            fieldWindowFor(Boolean(stake), trials, key),
          );
        }),
      ...nfts
        .filter((p) => !assignedKeys.has(`nft:${p.tokenId.toString()}`))
        .map((p) => {
          const id = p.tokenId.toString();
          const stake = stakes.get(`nft:${id}`);
          return mapBenchNft(
            p,
            Boolean(stake),
            stake?.stakedAt,
            fieldWindowFor(Boolean(stake), trials, `nft:${id}`),
          );
        }),
    ].sort((a, b) => b.overwall - a.overwall);

    const now = new Date();
    const canClaim = canClaimDailyRest(club.lastDailyRestAt, now);
    const nextAt = nextRestAvailableAt(club.lastDailyRestAt, now);
    const recoveryPerHour = await getCoachStaminaRecoveryPerHour(this.prisma);
    const coachAfflicted = await new AfflictionService(this.prisma).isCoachAfflicted(userId, now);
    const coachActive = !!club.coachHiredAt && !coachAfflicted;

    return {
      template: view.template,
      assignments: view.assignments,
      slots: view.slots,
      bench,
      stadiumLvl: view.stadiumLvl,
      ctLvl: club.ctLvl,
      passiveRecoveryPerHour: passiveRecoveryPerHour(
        club.ctLvl,
        coachActive,
        recoveryPerHour,
      ),
      canClaimDailyRest: canClaim,
      nextRestAvailableAt: nextAt?.toISOString() ?? null,
      lastDailyRestAt: club.lastDailyRestAt?.toISOString() ?? null,
    };
  }

  async claimDailyRest(userId: string): Promise<DailyRestResultDTO> {
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const now = new Date();
    if (!canClaimDailyRest(club.lastDailyRestAt, now)) {
      throw new AppError(ErrorCode.DAILY_REST_ALREADY_CLAIMED, 409, {
        nextRestAvailableAt: nextRestAvailableAt(club.lastDailyRestAt, now)?.toISOString(),
      });
    }

    const wallet = club.user?.wallet ?? null;
    let restoredCount = 0;
    const rules = await getStaminaRules(this.prisma);

    await this.staminaService.restoreSquad(userId, wallet, club.id, now);

    const { nfts, basePlayers } = await this.clubRepo.getInventory(userId, wallet);
    restoredCount = basePlayers.length + nfts.length;

    const nextAt = nextRestAvailableAt(now, now)!;

    return {
      restoredCount,
      restoredStamina: rules.dailyRestStamina,
      canClaimDailyRest: false,
      nextRestAvailableAt: nextAt.toISOString(),
      lastDailyRestAt: now.toISOString(),
    };
  }

  async saveLineup(userId: string, assignments: Record<string, LineupAssignment>) {
    await this.staminaService.syncDrift(userId);
    return this.stadiumPlayer.saveLineup(userId, assignments);
  }
}
