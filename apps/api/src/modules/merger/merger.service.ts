import type { MergeFuseInput, MergeRulesDTO, MergeResultDTO } from '@mll/shared';
import { MERGE_LADDER, MERGE_LEGENDARY_VALUE_GMT, mergeStepForInputRarity, playerAgeFromRoi } from '@mll/shared';
import { parseLineupAssignments } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import {
  GAME_CONFIG,
  POSITION_NAMES,
  RARITY_NAMES,
  rollMergeOverwall,
} from '../../config/game.js';
import type { ClubRepository } from '../club/club.repository.js';
import type { ItemTemplateService } from '../items/item-template.service.js';
import type { PassService } from '../pass/pass.service.js';
import type { StadiumRepository } from '../stadium/stadium.repository.js';
import { secureRandom } from '../../common/lib/secure-random.js';
import type { MergerRepository } from './merger.repository.js';
import { PlatformConfigService } from '../platform/platform-config.service.js';

export class MergerService {
  constructor(
    private readonly repo: MergerRepository,
    private readonly clubRepo: ClubRepository,
    private readonly stadiumRepo: StadiumRepository,
    private readonly itemTemplates: ItemTemplateService,
    private readonly prismaForConfig: import('@prisma/client').PrismaClient,
    private readonly passService?: PassService,
  ) {}

  private async getDiscountPct(): Promise<number> {
    const cfg = await new PlatformConfigService(this.prismaForConfig).get();
    return cfg.mergeDiscountPct;
  }

  async getRules(): Promise<MergeRulesDTO> {
    const discountPct = await this.getDiscountPct();
    const tiers = MERGE_LADDER.map((step) => {
      const [min, max] = GAME_CONFIG.MERGE.OVERWALL_RANGES[step.outputRarity]!;
      return {
        inputRarity: RARITY_NAMES[step.inputRarity]!,
        outputRarity: RARITY_NAMES[step.outputRarity]!,
        feeUsdc: step.feeGmt,
        effectiveFeeUsdc: parseFloat((step.feeGmt * (1 - discountPct)).toFixed(4)),
        discountPct,
        overwallRange: [min, max] as [number, number],
      };
    });

    return {
      inputCount: GAME_CONFIG.MERGE.INPUT_COUNT,
      tiers,
      legendaryValueGmt: MERGE_LEGENDARY_VALUE_GMT,
    };
  }

  async fuse(userId: string, input: MergeFuseInput): Promise<MergeResultDTO> {
    const { playerIds } = input;
    const unique = new Set(playerIds);
    if (unique.size !== playerIds.length) {
      throw new AppError(ErrorCode.MERGE_DUPLICATE_PLAYER, 400);
    }
    if (playerIds.length !== GAME_CONFIG.MERGE.INPUT_COUNT) {
      throw new AppError(ErrorCode.MERGE_INVALID_COUNT, 400, {
        expected: GAME_CONFIG.MERGE.INPUT_COUNT,
        received: playerIds.length,
      });
    }

    const club = await this.clubRepo.findByUserId(userId);
    if (!club) {
      throw new AppError(ErrorCode.CLUB_NOT_FOUND, 404);
    }

    const players = await this.repo.findBasePlayersByIds(userId, playerIds);
    if (players.length !== playerIds.length) {
      throw new AppError(ErrorCode.MERGE_PLAYER_NOT_FOUND, 404);
    }

    const retired = players.find((p) => p.retiredAt != null);
    if (retired) {
      throw new AppError(ErrorCode.MERGE_PLAYER_RETIRED, 400, { playerId: retired.id });
    }

    const inputRarity = players[0]!.rarity;
    if (!players.every((p) => p.rarity === inputRarity)) {
      throw new AppError(ErrorCode.MERGE_DIFFERENT_RARITY, 400);
    }
    const step = mergeStepForInputRarity(inputRarity);
    if (!step) {
      if (inputRarity >= RARITY_NAMES.length - 1) {
        throw new AppError(ErrorCode.MERGE_CANNOT_FUSE_LEGENDARY, 400);
      }
      throw new AppError(ErrorCode.MERGE_RARITY_NOT_FUSABLE, 400, {
        rarity: RARITY_NAMES[inputRarity] ?? inputRarity,
      });
    }

    const baseFee = step.feeGmt;
    const discountPct = await this.getDiscountPct();
    const feeUsdc = parseFloat((baseFee * (1 - discountPct)).toFixed(4));
    const balanceRow = await this.clubRepo.getMgtBalance(userId);
    const gmtBalance = Number(balanceRow?.amount ?? 0);
    // Merge fees are GMT-only (amount equals the listed fee; 1 GMT = 1 fee unit).
    const payWith = 'gmt' as const;

    if (gmtBalance < feeUsdc) {
      throw new AppError(ErrorCode.INSUFFICIENT_GMT, 400, {
        required: feeUsdc,
        current: gmtBalance,
      });
    }

    const listed = players.find((p) => p.listed);
    if (listed) {
      throw new AppError(ErrorCode.MERGE_PLAYER_LISTED, 400, { playerId: listed.id });
    }

    const lineupRow = await this.stadiumRepo.findLineupByClubId(club.id);
    const assignments = lineupRow ? parseLineupAssignments(lineupRow.assignments) : {};
    const lineupBaseIds = new Set(
      Object.values(assignments)
        .filter((a) => a.kind === 'base')
        .map((a) => a.playerId),
    );
    const inLineup = players.find((p) => lineupBaseIds.has(p.id));
    if (inLineup) {
      throw new AppError(ErrorCode.MERGE_PLAYER_IN_LINEUP, 400, { playerId: inLineup.id });
    }

    const outputRarity = step.outputRarity;
    const overwall = rollMergeOverwall(outputRarity, secureRandom);
    const template = await this.itemTemplates.pickForRarity(outputRarity);
    const first = players.find((p) => p.id === playerIds[0]) ?? players[0]!;

    const inputsCostBasis = players.reduce((sum, p) => sum + Number(p.costBasisUsdc ?? 0), 0);
    const lifetimeEarnedUsdc = players.reduce(
      (sum, p) => sum + Number(p.lifetimeEarnedUsdc ?? 0),
      0,
    );
    const summedBasis = parseFloat((inputsCostBasis + feeUsdc).toFixed(6));
    const costBasisUsdc = outputRarity === RARITY_NAMES.indexOf('legendary')
      ? Math.max(summedBasis, MERGE_LEGENDARY_VALUE_GMT)
      : summedBasis;
    const ageInfo = playerAgeFromRoi(costBasisUsdc, lifetimeEarnedUsdc);

    const row = await this.repo.fuse(
      userId,
      club.id,
      playerIds,
      feeUsdc,
      {
        rarity: outputRarity,
        overwall,
        position: first.position,
        name: template?.name ?? first.name,
        imageUrl: template?.imageUrl ?? first.imageUrl,
        templateId: template?.id ?? null,
        costBasisUsdc,
        lifetimeEarnedUsdc,
      },
      payWith,
    );

    await this.passService?.addXp(userId, GAME_CONFIG.PASS_XP.merge);

    return {
      inputRarity: RARITY_NAMES[inputRarity]!,
      outputRarity: RARITY_NAMES[outputRarity]!,
      burnedIds: playerIds,
      feeUsdc,
      newPlayer: {
        id: row.id,
        rarity: RARITY_NAMES[outputRarity]!,
        overwall: row.overwall,
        position: POSITION_NAMES[row.position] ?? 'FW',
        name: row.name,
        imageUrl: row.imageUrl,
        age: ageInfo.age,
        costBasisUsdc,
      },
    };
  }
}
