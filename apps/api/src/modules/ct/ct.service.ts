import type { PrismaClient } from '@prisma/client';
import type { CtRecordDTO, CtViewDTO } from '@mll/shared';
import { trainingEvolutionStep } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import {
  canClaimDailyRest,
  nextRestAvailableAt,
  passiveRecoveryPerHour,
} from '../../common/lib/stamina.js';
import { GAME_CONFIG, calculateUpgradeCost } from '../../config/game.js';
import { AfflictionService } from '../afflictions/affliction.service.js';
import { ClubRepository } from '../club/club.repository.js';
import { getCoachStaminaRecoveryPerHour } from '../office/office-config.js';
import { getStaminaRules } from '../stamina/stamina-rules.js';
import { StaminaService } from '../stamina/stamina.service.js';
import { listCtRecords } from './ct-record.js';

export class CtService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clubRepo: ClubRepository,
    private readonly staminaService: StaminaService,
  ) {}

  async getView(userId: string): Promise<CtViewDTO> {
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const now = new Date();
    const canClaim = canClaimDailyRest(club.lastDailyRestAt, now);
    const nextAt = nextRestAvailableAt(club.lastDailyRestAt, now);
    const atMaxLevel = club.ctLvl >= GAME_CONFIG.MAX_BUILDING_LEVEL;
    const upgradeCost = atMaxLevel ? null : calculateUpgradeCost(club.ctLvl);

    const lineup = await this.staminaService.getLineupStamina(userId);
    const staminas = lineup.map((p) => p.stamina);
    const avgStamina =
      staminas.length > 0
        ? Math.round(staminas.reduce((sum, v) => sum + v, 0) / staminas.length)
        : 0;
    const recoveryPerHour = await getCoachStaminaRecoveryPerHour(this.prisma);
    const rules = await getStaminaRules(this.prisma);
    const coachAfflicted = await new AfflictionService(this.prisma).isCoachAfflicted(userId, now);
    const coachActive = !!club.coachHiredAt && !coachAfflicted;
    const recoveryBonus = coachActive ? Math.max(0, Math.floor(club.ctLvl)) : 0;
    const records = await listCtRecords(this.prisma, userId, 12);

    return {
      ctLvl: club.ctLvl,
      maxLevel: GAME_CONFIG.MAX_BUILDING_LEVEL,
      passiveRecoveryPerHour: passiveRecoveryPerHour(
        club.ctLvl,
        coachActive,
        recoveryPerHour,
      ),
      recoveryBonus,
      evolutionStep: trainingEvolutionStep(club.ctLvl),
      coachHired: !!club.coachHiredAt,
      upgradeCost,
      canUpgrade: !atMaxLevel,
      canClaimDailyRest: canClaim,
      nextRestAvailableAt: nextAt?.toISOString() ?? null,
      lastDailyRestAt: club.lastDailyRestAt?.toISOString() ?? null,
      trainingStaminaCost: rules.trainingStaminaCost,
      dailyRestStamina: rules.dailyRestStamina,
      squadStaminaSummary: {
        lineupCount: staminas.length,
        avgStamina,
        minStamina: staminas.length > 0 ? Math.min(...staminas) : 0,
        maxStamina: staminas.length > 0 ? Math.max(...staminas) : 0,
      },
      records,
    };
  }

  async listRecords(
    userId: string,
    player?: { kind: 'base' | 'nft'; playerId: string },
  ): Promise<CtRecordDTO[]> {
    return listCtRecords(this.prisma, userId, 12, player);
  }
}
