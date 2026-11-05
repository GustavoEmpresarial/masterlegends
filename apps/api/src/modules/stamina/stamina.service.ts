import type { Prisma, PrismaClient } from '@prisma/client';
import type { LineupAssignment } from '@mll/shared';
import {
  MAX_LINEUP_STARTERS,
  MIN_STAMINA_AUTO_FIELD,
  fillRecoveredLineup,
  parseLineupAssignments,
  staminaDrainPerHourForIndex,
} from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { STAMINA_MAX, applyStaminaDrift } from '../../common/lib/stamina.js';
import { GAME_CONFIG } from '../../config/game.js';
import { writeStaminaLedger, type StaminaReason } from './stamina-ledger.js';
import { getStaminaRules } from './stamina-rules.js';
import { AfflictionService } from '../afflictions/affliction.service.js';
import { ClubRepository } from '../club/club.repository.js';
import { getCoachStaminaRecoveryPerHour } from '../office/office-config.js';
import { StadiumRepository } from '../stadium/stadium.repository.js';
import { VestiarioTemplateRepository } from '../vestiario/vestiario-template.repository.js';
import { loadFieldTrialWindows, withoutExpiredFreeField } from '../stadium/free-field.js';

type FillCandidate = {
  playerId: string;
  kind: 'base' | 'nft';
  overwall: number;
  position: number | string;
};

export type PlayerRef = { kind: 'base' | 'nft'; playerId: string };

type TxClient = Prisma.TransactionClient;

export class StaminaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clubRepo: ClubRepository,
    private readonly stadiumRepo: StadiumRepository,
    private readonly vestiarioTemplateRepo: VestiarioTemplateRepository,
  ) {}

  clampStamina(value: number): number {
    return Math.min(GAME_CONFIG.STAMINA.MAX, Math.max(0, value));
  }

  /**
   * Aplica drift de stamina em todos os jogadores. Em campo: drain por raridade.
   * No banco com treinador: recovery; sem treinador: inalterado.
   * Jogadores escalados que zerarem stamina são retirados do lineup.
   */
  async syncDrift(userId: string): Promise<void> {
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) return;
    const now = new Date();
    const afflictions = new AfflictionService(this.prisma);
    const coachAfflicted = await afflictions.isCoachAfflicted(userId, now);
    const coachHired = !!club.coachHiredAt && !coachAfflicted;
    const coachRate = coachHired ? await getCoachStaminaRecoveryPerHour(this.prisma) : 24;
    const ctBonus = coachHired && Number.isFinite(club.ctLvl) ? Math.max(0, club.ctLvl) : 0;
    const recoveryPerHour = coachRate + ctBonus;
    const wallet = club.user?.wallet ?? null;

    const lineupRow = await this.stadiumRepo.findLineupByClubId(club.id);
    let assignments = lineupRow ? parseLineupAssignments(lineupRow.assignments) : {};
    if (lineupRow && Object.keys(assignments).length > 0 && this.prisma.playerStake?.findMany) {
      const [stakeRows, windows] = await Promise.all([
        this.prisma.playerStake.findMany({
          where: { userId, status: 'active' },
          select: { kind: true, playerId: true },
        }),
        loadFieldTrialWindows(this.prisma, userId),
      ]);
      const stakedKeys = new Set(stakeRows.map((row) => `${row.kind}:${row.playerId}`));
      const expired = withoutExpiredFreeField(assignments, stakedKeys, windows, now.getTime());
      if (expired.changed) {
        assignments = expired.assignments;
        await this.stadiumRepo.upsertLineup(club.id, lineupRow.stadiumTemplateId, assignments);
      }
    }
    const onFieldBase = new Set<string>();
    const onFieldNft = new Set<string>();
    const slotByKey = new Map<string, string>(); // "kind:playerId" -> slotId
    for (const [slotId, a] of Object.entries(assignments)) {
      const key = `${a.kind}:${a.playerId}`;
      slotByKey.set(key, slotId);
      if (a.kind === 'base') onFieldBase.add(a.playerId);
      else onFieldNft.add(a.playerId);
    }

    const slotsToBench: string[] = [];
    // Fora de campo, com stake e stamina cheia: o treinador devolve o jogador à posição.
    const offFieldCandidates: FillCandidate[] = [];
    const stakedKeys = coachHired
      ? new Set(
          (
            await this.prisma.playerStake.findMany({
              where: { userId, status: 'active' },
              select: { kind: true, playerId: true },
            })
          ).map((row) => `${row.kind}:${row.playerId}`),
        )
      : new Set<string>();

    const basePlayers = await this.prisma.basePlayer.findMany({
      where: { userId },
      select: {
        id: true,
        rarity: true,
        position: true,
        overwall: true,
        stamina: true,
        staminaUpdatedAt: true,
        retiredAt: true,
        listed: true,
      },
    });
    for (const p of basePlayers) {
      const onField = onFieldBase.has(p.id);
      const fieldDrain = onField ? staminaDrainPerHourForIndex(p.rarity) : undefined;
      const next = applyStaminaDrift(
        p.stamina,
        p.staminaUpdatedAt,
        now,
        coachHired,
        recoveryPerHour,
        onField,
        fieldDrain,
      );
      if (next !== p.stamina) {
        await this.prisma.basePlayer.update({
          where: { id: p.id },
          data: { stamina: next, staminaUpdatedAt: now },
        });
        await writeStaminaLedger(this.prisma, {
          userId,
          playerKind: 'base',
          playerId: p.id,
          reason: onField ? 'field' : 'coach',
          before: p.stamina,
          after: next,
        });
      }
      if (onField && next <= 0) {
        const slotId = slotByKey.get(`base:${p.id}`);
        if (slotId) slotsToBench.push(slotId);
      }
      if (
        coachHired &&
        !onField &&
        !p.retiredAt &&
        !p.listed &&
        next >= MIN_STAMINA_AUTO_FIELD &&
        stakedKeys.has(`base:${p.id}`)
      ) {
        offFieldCandidates.push({
          playerId: p.id,
          kind: 'base',
          overwall: p.overwall,
          position: p.position,
        });
      }
    }

    if (wallet) {
      const nfts = await this.prisma.playerCache.findMany({
        where: { ownerWallet: wallet.toLowerCase() },
        select: { tokenId: true, rarity: true, position: true, overwall: true, stamina: true, staminaUpdatedAt: true },
      });
      for (const p of nfts) {
        const tokenIdStr = p.tokenId.toString();
        const onField = onFieldNft.has(tokenIdStr);
        const fieldDrain = onField ? staminaDrainPerHourForIndex(p.rarity) : undefined;
        const next = applyStaminaDrift(
          p.stamina,
          p.staminaUpdatedAt,
          now,
          coachHired,
          recoveryPerHour,
          onField,
          fieldDrain,
        );
        if (next !== p.stamina) {
          await this.prisma.playerCache.update({
            where: { tokenId: p.tokenId },
            data: { stamina: next, staminaUpdatedAt: now },
          });
          await writeStaminaLedger(this.prisma, {
            userId,
            playerKind: 'nft',
            playerId: tokenIdStr,
            reason: onField ? 'field' : 'coach',
            before: p.stamina,
            after: next,
          });
        }
        if (onField && next <= 0) {
          const slotId = slotByKey.get(`nft:${tokenIdStr}`);
          if (slotId) slotsToBench.push(slotId);
        }
        if (
          coachHired &&
          !onField &&
          next >= MIN_STAMINA_AUTO_FIELD &&
          stakedKeys.has(`nft:${tokenIdStr}`)
        ) {
          offFieldCandidates.push({
            playerId: tokenIdStr,
            kind: 'nft',
            overwall: p.overwall,
            position: p.position,
          });
        }
      }
    }

    if (!lineupRow) return;

    let nextAssignments = { ...assignments };
    let lineupChanged = false;

    if (slotsToBench.length > 0) {
      for (const slotId of slotsToBench) delete nextAssignments[slotId];
      lineupChanged = true;
    }

    // Devolve quem está em 100% para uma vaga vazia da mesma posição. Não tira quem ainda tem stamina.
    if (coachHired && offFieldCandidates.length > 0) {
      const template = await this.vestiarioTemplateRepo.getDefault();
      const filled = fillRecoveredLineup(template.slots, nextAssignments, offFieldCandidates);
      nextAssignments = filled.assignments;
      if (filled.changed) lineupChanged = true;
    }

    if (lineupChanged) {
      await this.stadiumRepo.upsertLineup(
        club.id,
        lineupRow.stadiumTemplateId,
        nextAssignments as Prisma.InputJsonValue,
      );
    }
  }

  async restoreSquad(
    userId: string,
    wallet: string | null | undefined,
    clubId: string,
    now: Date,
  ): Promise<void> {
    const rules = await getStaminaRules(this.prisma);
    await this.clubRepo.restoreAllStamina(userId, wallet, clubId, now, rules.dailyRestStamina);
  }

  async applyDeltaInTx(
    tx: TxClient,
    userId: string,
    wallet: string | null | undefined,
    ref: PlayerRef,
    delta: number,
    options?: { rejectIfFullOnGain?: boolean; rejectIfShort?: boolean; reason?: StaminaReason },
  ): Promise<{ staminaBefore: number; staminaAfter: number }> {
    const now = new Date();

    if (ref.kind === 'base') {
      const player = await tx.basePlayer.findFirst({
        where: { id: ref.playerId, userId },
      });
      if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 404);

      const staminaBefore = player.stamina;
      if (delta > 0 && options?.rejectIfFullOnGain && staminaBefore >= STAMINA_MAX) {
        throw new AppError(ErrorCode.STAMINA_ALREADY_FULL, 400);
      }
      if (delta < 0 && options?.rejectIfShort && staminaBefore + delta < 0) {
        throw new AppError(ErrorCode.INSUFFICIENT_STAMINA, 400, { minStamina: -delta });
      }

      const staminaAfter = this.clampStamina(staminaBefore + delta);
      await tx.basePlayer.update({
        where: { id: player.id },
        data: { stamina: staminaAfter, staminaUpdatedAt: now },
      });
      if (options?.reason) {
        await writeStaminaLedger(tx, {
          userId,
          playerKind: 'base',
          playerId: player.id,
          reason: options.reason,
          before: staminaBefore,
          after: staminaAfter,
        });
      }
      return { staminaBefore, staminaAfter };
    }

    if (!wallet) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 404);
    const tokenId = BigInt(ref.playerId);
    const player = await tx.playerCache.findFirst({
      where: { tokenId, ownerWallet: wallet },
    });
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 404);

    const staminaBefore = player.stamina;
    if (delta > 0 && options?.rejectIfFullOnGain && staminaBefore >= STAMINA_MAX) {
      throw new AppError(ErrorCode.STAMINA_ALREADY_FULL, 400);
    }
    if (delta < 0 && options?.rejectIfShort && staminaBefore + delta < 0) {
      throw new AppError(ErrorCode.INSUFFICIENT_STAMINA, 400, { minStamina: -delta });
    }

    const staminaAfter = this.clampStamina(staminaBefore + delta);
    await tx.playerCache.update({
      where: { tokenId },
      data: { stamina: staminaAfter, staminaUpdatedAt: now },
    });
    if (options?.reason) {
      await writeStaminaLedger(tx, {
        userId,
        playerKind: 'nft',
        playerId: ref.playerId,
        reason: options.reason,
        before: staminaBefore,
        after: staminaAfter,
      });
    }
    return { staminaBefore, staminaAfter };
  }

  async applyDelta(
    userId: string,
    ref: PlayerRef,
    delta: number,
    options?: { rejectIfFullOnGain?: boolean; rejectIfShort?: boolean; reason?: StaminaReason },
  ): Promise<{ staminaBefore: number; staminaAfter: number }> {
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    const wallet = club.user?.wallet ?? null;

    return this.prisma.$transaction((tx) =>
      this.applyDeltaInTx(tx, userId, wallet, ref, delta, options),
    );
  }

  async getLineupAssignments(userId: string): Promise<Record<string, LineupAssignment>> {
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const lineupRow = await this.stadiumRepo.findLineupByClubId(club.id);
    return lineupRow ? parseLineupAssignments(lineupRow.assignments) : {};
  }

  async getLineupStamina(
    userId: string,
  ): Promise<Array<{ ref: PlayerRef; stamina: number }>> {
    await this.syncDrift(userId);
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const assignments = await this.getLineupAssignments(userId);
    const wallet = club.user?.wallet ?? null;
    const entries = Object.values(assignments);

    const result: Array<{ ref: PlayerRef; stamina: number }> = [];
    for (const a of entries) {
      if (a.kind === 'base') {
        const player = await this.prisma.basePlayer.findFirst({
          where: { id: a.playerId, userId },
          select: { stamina: true },
        });
        if (player) {
          result.push({ ref: { kind: 'base', playerId: a.playerId }, stamina: player.stamina });
        }
      } else if (wallet) {
        const tokenId = BigInt(a.playerId);
        const player = await this.prisma.playerCache.findFirst({
          where: { tokenId, ownerWallet: wallet },
          select: { stamina: true },
        });
        if (player) {
          result.push({ ref: { kind: 'nft', playerId: a.playerId }, stamina: player.stamina });
        }
      }
    }
    return result;
  }

  async validateLineupForAction(userId: string, minStamina: number): Promise<void> {
    const lineup = await this.getLineupStamina(userId);
    if (lineup.length < MAX_LINEUP_STARTERS) {
      throw new AppError(ErrorCode.LINEUP_INCOMPLETE, 400, {
        required: MAX_LINEUP_STARTERS,
        current: lineup.length,
      });
    }

    const low = lineup.filter((p) => p.stamina < minStamina);
    if (low.length > 0) {
      throw new AppError(ErrorCode.INSUFFICIENT_STAMINA, 400, {
        minStamina,
        lowCount: low.length,
      });
    }
  }

  async consumeLineupInTx(
    tx: TxClient,
    userId: string,
    wallet: string | null | undefined,
    amount: number,
    reason: StaminaReason = 'match',
    options?: { rejectIfShort?: boolean },
  ): Promise<number> {
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const lineupRow = await this.stadiumRepo.findLineupByClubId(club.id);
    const assignments = lineupRow ? parseLineupAssignments(lineupRow.assignments) : {};
    const now = new Date();
    const starters: Array<{ kind: 'base' | 'nft'; playerId: string; stamina: number; tokenId?: bigint }> = [];

    for (const a of Object.values(assignments)) {
      if (a.kind === 'base') {
        const player = await tx.basePlayer.findFirst({
          where: { id: a.playerId, userId },
          select: { stamina: true },
        });
        if (!player) continue;
        starters.push({ kind: 'base', playerId: a.playerId, stamina: player.stamina });
      } else if (wallet) {
        const tokenId = BigInt(a.playerId);
        const player = await tx.playerCache.findFirst({
          where: { tokenId, ownerWallet: wallet },
          select: { stamina: true },
        });
        if (!player) continue;
        starters.push({ kind: 'nft', playerId: a.playerId, stamina: player.stamina, tokenId });
      }
    }

    if (options?.rejectIfShort && amount > 0) {
      const short = starters.filter((p) => p.stamina < amount);
      if (short.length > 0) {
        throw new AppError(ErrorCode.INSUFFICIENT_STAMINA, 400, {
          minStamina: amount,
          lowCount: short.length,
        });
      }
    }

    let updated = 0;
    for (const starter of starters) {
      const staminaAfter = this.clampStamina(starter.stamina - amount);
      if (starter.kind === 'base') {
        await tx.basePlayer.update({
          where: { id: starter.playerId },
          data: { stamina: staminaAfter, staminaUpdatedAt: now },
        });
      } else if (starter.tokenId != null) {
        await tx.playerCache.update({
          where: { tokenId: starter.tokenId },
          data: { stamina: staminaAfter, staminaUpdatedAt: now },
        });
      }
      await writeStaminaLedger(tx, {
        userId,
        playerKind: starter.kind,
        playerId: starter.playerId,
        reason,
        before: starter.stamina,
        after: staminaAfter,
      });
      updated += 1;
    }

    return updated;
  }

  /** Farm claim: each starter loses stamina proportional to rarity × hours elapsed. */
  async consumeLineupFarmInTx(
    tx: TxClient,
    userId: string,
    wallet: string | null | undefined,
    hoursElapsed: number,
  ): Promise<{ playersUpdated: number; totalDrained: number }> {
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);

    const lineupRow = await this.stadiumRepo.findLineupByClubId(club.id);
    const assignments = lineupRow ? parseLineupAssignments(lineupRow.assignments) : {};
    const now = new Date();
    let playersUpdated = 0;
    let totalDrained = 0;

    for (const a of Object.values(assignments)) {
      if (a.kind === 'base') {
        const player = await tx.basePlayer.findFirst({
          where: { id: a.playerId, userId },
        });
        if (!player) continue;
        const amount = Math.floor(hoursElapsed * staminaDrainPerHourForIndex(player.rarity));
        const staminaAfter = this.clampStamina(player.stamina - amount);
        await tx.basePlayer.update({
          where: { id: player.id },
          data: { stamina: staminaAfter, staminaUpdatedAt: now },
        });
        await writeStaminaLedger(tx, {
          userId,
          playerKind: 'base',
          playerId: player.id,
          reason: 'field',
          before: player.stamina,
          after: staminaAfter,
        });
        playersUpdated += 1;
        totalDrained += amount;
      } else if (wallet) {
        const tokenId = BigInt(a.playerId);
        const player = await tx.playerCache.findFirst({
          where: { tokenId, ownerWallet: wallet },
        });
        if (!player) continue;
        const amount = Math.floor(hoursElapsed * staminaDrainPerHourForIndex(player.rarity));
        const staminaAfter = this.clampStamina(player.stamina - amount);
        await tx.playerCache.update({
          where: { tokenId },
          data: { stamina: staminaAfter, staminaUpdatedAt: now },
        });
        await writeStaminaLedger(tx, {
          userId,
          playerKind: 'nft',
          playerId: a.playerId,
          reason: 'field',
          before: player.stamina,
          after: staminaAfter,
        });
        playersUpdated += 1;
        totalDrained += amount;
      }
    }

    return { playersUpdated, totalDrained };
  }

  async consumeLineup(userId: string, amount: number, reason: StaminaReason = 'match'): Promise<number> {
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    const wallet = club.user?.wallet ?? null;

    return this.prisma.$transaction((tx) =>
      this.consumeLineupInTx(tx, userId, wallet, amount, reason, { rejectIfShort: true }),
    );
  }

  async readStamina(userId: string, ref: PlayerRef): Promise<number> {
    const club = await this.clubRepo.findByUserId(userId);
    if (!club) throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    if (ref.kind === 'base') {
      const player = await this.prisma.basePlayer.findFirst({
        where: { id: ref.playerId, userId },
        select: { stamina: true },
      });
      if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 404);
      return player.stamina;
    }
    const wallet = club.user?.wallet;
    if (!wallet) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 404);
    const player = await this.prisma.playerCache.findFirst({
      where: { tokenId: BigInt(ref.playerId), ownerWallet: wallet },
      select: { stamina: true },
    });
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND, 404);
    return player.stamina;
  }
}
