import type { PrismaClient } from '@prisma/client';
import type {
  LineupAssignment,
  LineupPlayerDTO,
  StadiumSlot,
  StadiumTemplatePublicDTO,
  StadiumViewDTO,
} from '@mll/shared';
import {
  MAX_LINEUP_STARTERS,
  RIVAL_CLUB_NAME,
  STAMINA_MAX,
  buildRivalSlots,
  fieldRole,
  isAwaySlot,
  parseLineupAssignments,
  playerAgeFromRoi,
  positionPower,
  readPlayerAttributes,
  remapAssignmentsToDisplaySlots,
  resolvePlayerDisplayName,
  stadiumSlotsSchema,
  stakeGmtForRarityIndex,
  stakeGmtForRarityName,
  type FreeFieldWindowDTO,
} from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { POSITION_NAMES, RARITY_NAMES } from '../../config/game.js';
import { ClubRepository } from '../club/club.repository.js';
import { loadActiveStakes, type ActivePlayerStake } from '../player-stake/player-stake.service.js';
import { VestiarioTemplateRepository } from '../vestiario/vestiario-template.repository.js';
import { StaminaService } from '../stamina/stamina.service.js';
import { StadiumRepository } from './stadium.repository.js';
import { StadiumLicenseService } from './stadium-license.service.js';
import { fieldWindowFor, loadFieldTrialWindows, startFieldTrial } from './free-field.js';

type InventoryMap = Map<string, LineupPlayerDTO>;

function toPublicTemplate(row: {
  id: string;
  name: string;
  imageUrl: string;
  slots: unknown;
}): StadiumTemplatePublicDTO {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.imageUrl,
    slots: stadiumSlotsSchema.parse(row.slots) as StadiumSlot[],
  };
}

function markLineup(
  inventory: InventoryMap,
  assignments: Record<string, LineupAssignment>,
) {
  for (const player of inventory.values()) player.inLineup = false;
  for (const assignment of Object.values(assignments)) {
    const player = inventory.get(inventoryKey(assignment.kind, assignment.playerId));
    if (player) player.inLineup = true;
  }
}

function mapInventory(
  basePlayers: Array<{
    id: string;
    rarity: number;
    overwall: number;
    position: number;
    name: string | null;
    imageUrl: string | null;
    stamina: number;
    source: string | null;
    expiresAt: Date | null;
    listed?: boolean;
    createdAt?: Date;
    attributes?: unknown;
    costBasisUsdc?: { toString(): string } | number;
    lifetimeEarnedUsdc?: { toString(): string } | number;
  }>,
  nfts: Array<{
    tokenId: bigint;
    rarity: number;
    overwall: number;
    position: number;
    stamina: number;
    createdAt?: Date;
    attributes?: unknown;
  }>,
  ownerName: string | null,
  /** `null` = treat every player as staked (unit tests without prisma). */
  stakeKeys: Set<string> | Map<string, ActivePlayerStake> | null = null,
  trialWindows: Map<string, string> | null = null,
): InventoryMap {
  const map: InventoryMap = new Map();
  const stakeOf = (key: string): { staked: boolean; stakedAt: string | null } => {
    if (stakeKeys == null) return { staked: true, stakedAt: null };
    if (stakeKeys instanceof Map) {
      const row = stakeKeys.get(key);
      return { staked: Boolean(row), stakedAt: row?.stakedAt ?? null };
    }
    return { staked: stakeKeys.has(key), stakedAt: null };
  };
  for (const p of basePlayers) {
    const costBasisUsdc = Number(p.costBasisUsdc ?? 0);
    const lifetimeEarnedUsdc = Number(p.lifetimeEarnedUsdc ?? 0);
    const career = playerAgeFromRoi(costBasisUsdc, lifetimeEarnedUsdc);
    const attributes = readPlayerAttributes(p.attributes, p.id, p.rarity, p.position);
    const stakeGmt = stakeGmtForRarityIndex(p.rarity);
    const stake = stakeOf(`base:${p.id}`);
    const freeField: FreeFieldWindowDTO = fieldWindowFor(stake.staked, trialWindows, `base:${p.id}`);
    const dto: LineupPlayerDTO = {
      id: p.id,
      kind: 'base',
      rarity: RARITY_NAMES[p.rarity] ?? 'common',
      overwall: p.overwall,
      position: POSITION_NAMES[p.position] ?? 'FW',
      name: resolvePlayerDisplayName(p.name, p.id),
      imageUrl: p.imageUrl,
      stamina: p.stamina,
      staminaMax: STAMINA_MAX,
      source: p.source,
      expiresAt: p.expiresAt?.toISOString() ?? null,
      costBasisUsdc,
      lifetimeEarnedUsdc,
      age: career.hasCareerCycle ? career.age : undefined,
      retireAge: career.hasCareerCycle ? career.retireAge : undefined,
      roiPct: career.hasCareerCycle ? career.roiPct : undefined,
      createdAt: p.createdAt?.toISOString() ?? null,
      listed: p.listed ?? false,
      ownerName,
      attributes,
      positionPower: positionPower(attributes, p.position),
      staked: stake.staked,
      stakedAt: stake.stakedAt,
      stakeGmt,
      freeField,
    };
    map.set(`base:${p.id}`, dto);
  }
  for (const p of nfts) {
    const id = p.tokenId.toString();
    const attributes = readPlayerAttributes(p.attributes, id, p.rarity, p.position);
    const stakeGmt = stakeGmtForRarityIndex(p.rarity);
    const stake = stakeOf(`nft:${id}`);
    const freeField: FreeFieldWindowDTO = fieldWindowFor(stake.staked, trialWindows, `nft:${id}`);
    const dto: LineupPlayerDTO = {
      id,
      kind: 'nft',
      tokenId: id,
      rarity: RARITY_NAMES[p.rarity] ?? 'common',
      overwall: p.overwall,
      position: POSITION_NAMES[p.position] ?? 'FW',
      stamina: p.stamina,
      staminaMax: STAMINA_MAX,
      createdAt: p.createdAt?.toISOString() ?? null,
      listed: false,
      ownerName,
      attributes,
      positionPower: positionPower(attributes, p.position),
      staked: stake.staked,
      stakedAt: stake.stakedAt,
      stakeGmt,
      freeField,
    };
    map.set(`nft:${id}`, dto);
  }
  return map;
}

function inventoryKey(kind: 'base' | 'nft', playerId: string): string {
  return `${kind}:${playerId}`;
}

/** Remove slot assignments that point to sold, merged, missing, or unstaked players. */
function pruneAssignments(
  assignments: Record<string, LineupAssignment>,
  inventory: InventoryMap,
  slotById: Map<string, StadiumSlot>,
): Record<string, LineupAssignment> {
  const pruned: Record<string, LineupAssignment> = {};
  for (const [slotId, assignment] of Object.entries(assignments)) {
    const slot = slotById.get(slotId);
    if (!slot || slot.role === 'DECOR') continue;
    const key = inventoryKey(assignment.kind, assignment.playerId);
    const player = inventory.get(key);
    if (!player) continue;
    if (player.freeField?.state !== 'unlimited' && player.freeField?.state !== 'playing') continue;
    if (slot.role && fieldRole(player.position) !== fieldRole(slot.role)) continue;
    pruned[slotId] = assignment;
  }
  return pruned;
}

function assignmentsChanged(
  before: Record<string, LineupAssignment>,
  after: Record<string, LineupAssignment>,
): boolean {
  const beforeKeys = Object.keys(before);
  const afterKeys = Object.keys(after);
  if (beforeKeys.length !== afterKeys.length) return true;
  return afterKeys.some((slotId) => {
    const a = before[slotId];
    const b = after[slotId];
    return !a || a.kind !== b.kind || a.playerId !== b.playerId;
  });
}

export class StadiumPlayerService {
  constructor(
    private readonly stadiumRepo: StadiumRepository,
    private readonly clubRepo: ClubRepository,
    private readonly vestiarioTemplateRepo: VestiarioTemplateRepository,
    private readonly prisma?: PrismaClient,
    private readonly staminaService?: StaminaService,
  ) {}

  private async resolveLineupTemplateId(clubId: string): Promise<string> {
    const lineup = await this.stadiumRepo.findLineupByClubId(clubId);
    if (lineup?.stadiumTemplateId) {
      // Without prisma (unit tests), trust the stored template id.
      if (!this.prisma) return lineup.stadiumTemplateId;
      const licenseService = new StadiumLicenseService(this.prisma);
      const ok = await licenseService.hasSignedLicense(clubId, lineup.stadiumTemplateId);
      if (ok) return lineup.stadiumTemplateId;
    }

    const defaultStadium = await this.stadiumRepo.findDefaultTemplate();
    if (!defaultStadium) {
      throw new AppError(ErrorCode.STADIUM_NOT_AVAILABLE, 404);
    }
    return defaultStadium.id;
  }

  private async loadVestiarioTemplate(): Promise<StadiumTemplatePublicDTO> {
    const row = await this.vestiarioTemplateRepo.getDefault();
    return {
      id: row.id,
      name: 'Vestiário',
      imageUrl: row.imageUrl,
      backgroundType: row.backgroundType,
      slots: row.slots,
    };
  }

  async getView(userId: string): Promise<StadiumViewDTO> {
    if (this.staminaService) {
      await this.staminaService.syncDrift(userId);
    }

    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const lineupRow = await this.stadiumRepo.findLineupByClubId(club.id);
    const templateId = await this.resolveLineupTemplateId(club.id);

    let templateRow =
      lineupRow?.stadiumTemplate?.id === templateId
        ? lineupRow.stadiumTemplate
        : await this.stadiumRepo.findById(templateId);
    if (!templateRow) {
      templateRow = await this.stadiumRepo.findDefaultTemplate();
    }
    if (!templateRow) {
      throw new AppError(ErrorCode.STADIUM_NOT_AVAILABLE, 404);
    }

    const template = toPublicTemplate(templateRow);
    const vestiario = await this.loadVestiarioTemplate();
    const rawAssignments = lineupRow
      ? parseLineupAssignments(lineupRow.assignments)
      : {};

    const wallet = club.user?.wallet ?? null;
    const { nfts, basePlayers } = await this.clubRepo.getInventory(userId, wallet);
    const stakeKeys = this.prisma ? await loadActiveStakes(this.prisma, userId) : null;
    const trialWindows = this.prisma ? await loadFieldTrialWindows(this.prisma, userId) : null;
    const inventory = mapInventory(basePlayers, nfts, club.name, stakeKeys, trialWindows);

    // Storage keys are vestiário slot IDs — never prune against stadium slot IDs.
    const vestiarioSlotById = new Map(vestiario.slots.map((s) => [s.id, s]));
    const storedAssignments = pruneAssignments(rawAssignments, inventory, vestiarioSlotById);

    if (
      lineupRow &&
      (assignmentsChanged(rawAssignments, storedAssignments) ||
        lineupRow.stadiumTemplateId !== templateRow.id)
    ) {
      await this.stadiumRepo.upsertLineup(club.id, templateRow.id, storedAssignments);
    }

    const pitchSlots = template.slots.filter((slot) => !isAwaySlot(slot));
    const assignments = remapAssignmentsToDisplaySlots(
      vestiario.slots,
      pitchSlots,
      storedAssignments,
    );
    markLineup(inventory, storedAssignments);

    const slots = pitchSlots.map((slot) => ({
      slot,
      player: this.resolvePlayer(assignments[slot.id], inventory),
    }));

    return {
      template,
      assignments,
      slots,
      stadiumLvl: club.stadiumLvl,
      opponents: buildRivalSlots(template.slots),
      opponentClubName: RIVAL_CLUB_NAME,
    };
  }

  async getVestiarioView(userId: string): Promise<StadiumViewDTO> {
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const template = await this.loadVestiarioTemplate();
    const lineupRow = await this.stadiumRepo.findLineupByClubId(club.id);
    const rawAssignments = lineupRow ? parseLineupAssignments(lineupRow.assignments) : {};

    const wallet = club.user?.wallet ?? null;
    const { nfts, basePlayers } = await this.clubRepo.getInventory(userId, wallet);
    const stakeKeys = this.prisma ? await loadActiveStakes(this.prisma, userId) : null;
    const trialWindows = this.prisma ? await loadFieldTrialWindows(this.prisma, userId) : null;
    const inventory = mapInventory(basePlayers, nfts, club.name, stakeKeys, trialWindows);
    const slotById = new Map(template.slots.map((s) => [s.id, s]));
    const assignments = pruneAssignments(rawAssignments, inventory, slotById);
    markLineup(inventory, assignments);

    if (lineupRow && assignmentsChanged(rawAssignments, assignments)) {
      const templateId = await this.resolveLineupTemplateId(club.id);
      await this.stadiumRepo.upsertLineup(club.id, templateId, assignments);
    }

    const slots = template.slots.map((slot) => ({
      slot,
      player: this.resolvePlayer(assignments[slot.id], inventory),
    }));

    return {
      template,
      assignments,
      slots,
      stadiumLvl: club.stadiumLvl,
    };
  }

  async saveLineup(userId: string, assignments: Record<string, LineupAssignment>): Promise<StadiumViewDTO> {
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const template = await this.loadVestiarioTemplate();
    const slotById = new Map(template.slots.map((s) => [s.id, s]));

    const wallet = club.user?.wallet ?? null;
    const { nfts, basePlayers } = await this.clubRepo.getInventory(userId, wallet);
    const stakeKeys = this.prisma ? await loadActiveStakes(this.prisma, userId) : null;
    const trialWindows = this.prisma ? await loadFieldTrialWindows(this.prisma, userId) : null;
    const inventory = mapInventory(basePlayers, nfts, club.name, stakeKeys, trialWindows);

    const usedPlayers = new Set<string>();
    let starterCount = 0;

    for (const [slotId, assignment] of Object.entries(assignments)) {
      const slot = slotById.get(slotId);
      if (!slot) {
        throw new AppError(ErrorCode.LINEUP_INVALID, 400, { reason: 'unknown_slot', slotId });
      }
      if (slot.role === 'DECOR') {
        throw new AppError(ErrorCode.LINEUP_INVALID, 400, { reason: 'decor_slot', slotId });
      }

      const key = inventoryKey(assignment.kind, assignment.playerId);
      if (!inventory.has(key)) {
        throw new AppError(ErrorCode.LINEUP_INVALID, 400, {
          reason: 'player_not_owned',
          playerId: assignment.playerId,
        });
      }
      if (usedPlayers.has(key)) {
        throw new AppError(ErrorCode.LINEUP_INVALID, 400, { reason: 'duplicate_player', playerId: assignment.playerId });
      }
      const player = inventory.get(key);
      if (player && player.freeField?.state === 'locked') {
        throw new AppError(ErrorCode.PLAYER_FREE_FIELD_LOCKED, 400, {
          reason: 'free_field_locked',
          playerId: assignment.playerId,
          kind: assignment.kind,
          nextPlayAt: player.freeField.nextPlayAt,
          stakeGmt: player.stakeGmt ?? stakeGmtForRarityName(player.rarity ?? 'common'),
        });
      }
      if (player && player.freeField?.state === 'ready' && this.prisma) {
        const started = new Date();
        await startFieldTrial(this.prisma, userId, assignment.kind, assignment.playerId, started);
        player.freeField = fieldWindowFor(false, new Map([[key, started.toISOString()]]), key, started.getTime());
      }
      if (slot.role && player && fieldRole(player.position) !== fieldRole(slot.role)) {
        throw new AppError(ErrorCode.LINEUP_INVALID, 400, {
          reason: 'position_mismatch',
          slotId,
          position: player.position,
          role: slot.role,
        });
      }
      usedPlayers.add(key);
      starterCount += 1;
    }

    if (starterCount > MAX_LINEUP_STARTERS) {
      throw new AppError(ErrorCode.LINEUP_INVALID, 400, {
        reason: 'too_many_starters',
        max: MAX_LINEUP_STARTERS,
      });
    }

    if (this.prisma) {
      await this.activateReferralNfts(userId, assignments);
    }

    const templateId = await this.resolveLineupTemplateId(club.id);
    await this.stadiumRepo.upsertLineup(club.id, templateId, assignments);
    markLineup(inventory, assignments);

    const slots = template.slots.map((slot) => ({
      slot,
      player: this.resolvePlayer(assignments[slot.id], inventory),
    }));

    return {
      template,
      assignments,
      slots,
      stadiumLvl: club.stadiumLvl,
    };
  }

  private async activateReferralNfts(userId: string, assignments: Record<string, LineupAssignment>): Promise<void> {
    if (!this.prisma) return;
    const baseIds = Object.values(assignments)
      .filter((a) => a.kind === 'base')
      .map((a) => a.playerId);
    if (baseIds.length === 0) return;

    const referralPlayers = await this.prisma.basePlayer.findMany({
      where: { id: { in: baseIds }, userId, source: 'referral', fieldedAt: null },
      select: { id: true },
    });
    if (referralPlayers.length === 0) return;

    const cfg = await this.prisma.platformConfig.findUnique({
      where: { id: 'default' },
      select: { referralNftDurationDays: true },
    });
    const days = cfg?.referralNftDurationDays ?? 30;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    await this.prisma.basePlayer.updateMany({
      where: { id: { in: referralPlayers.map((p) => p.id) } },
      data: { fieldedAt: now, expiresAt },
    });
  }

  private resolvePlayer(
    assignment: LineupAssignment | undefined,
    inventory: InventoryMap,
  ): LineupPlayerDTO | null {
    if (!assignment) return null;
    return inventory.get(inventoryKey(assignment.kind, assignment.playerId)) ?? null;
  }
}
