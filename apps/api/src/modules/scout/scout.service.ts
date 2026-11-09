import type { MintInput } from '@mll/shared';
import {
  SCOUT_COST_GMT,
  SCOUT_LATERAL_CHANCE,
  SCOUT_RARITY_WEIGHTS,
  buildScoutRules,
  generatePlayerDisplayName,
  isPlaceholderPlayerName,
  playerAgeFromRoi,
  readPlayerAttributes,
  rollScoutOverwall,
  rollScoutRarityIndex,
  type ScoutRarityWeights,
  type ScoutRulesDTO,
} from '@mll/shared';
import type { ItemTemplate, PrismaClient } from '@prisma/client';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { secureRandom } from '../../common/lib/secure-random.js';
import type { JobQueues } from '../../common/lib/queues.js';
import { GAME_CONFIG, POSITION_NAMES, RARITY_NAMES } from '../../config/game.js';
import { ClubService } from '../club/club.service.js';
import type { PassService } from '../pass/pass.service.js';
import type { ItemTemplateService } from '../items/item-template.service.js';
import { PlatformConfigService } from '../platform/platform-config.service.js';
import { ScoutRepository } from './scout.repository.js';

export class ScoutService {
  constructor(
    private readonly repo: ScoutRepository,
    private readonly clubService: ClubService,
    private readonly itemTemplates: ItemTemplateService,
    private readonly passService?: PassService,
    private readonly queues?: JobQueues,
    private readonly prismaForConfig?: PrismaClient,
  ) {}

  private async getScoutTuning(): Promise<{ discountPct: number; weights: ScoutRarityWeights; costGmt: number }> {
    if (!this.prismaForConfig) {
      return { discountPct: 0, weights: { ...SCOUT_RARITY_WEIGHTS }, costGmt: SCOUT_COST_GMT };
    }
    const cfg = await new PlatformConfigService(this.prismaForConfig).get();
    return { discountPct: cfg.scoutDiscountPct, weights: cfg.scoutRarityWeights, costGmt: cfg.scoutCostGmt };
  }

  async getRules(): Promise<ScoutRulesDTO> {
    const { discountPct, weights, costGmt } = await this.getScoutTuning();
    return buildScoutRules(discountPct, weights, costGmt);
  }

  /**
   * Server-authoritative roll: fixed rarity weights; template supplies stats and cosmetics.
   */
  private async rollOne(
    rand: () => number = secureRandom,
    weights: ScoutRarityWeights = SCOUT_RARITY_WEIGHTS,
  ): Promise<{
    rarity: number;
    overwall: number;
    position: number;
    template: ItemTemplate;
  }> {
    const rarity = rollScoutRarityIndex(rand, weights);
    const template = await this.itemTemplates.pickForRarity(rarity, rand);
    if (!template) {
      throw new AppError(ErrorCode.SCOUT_POOL_EMPTY, 503, {
        rarity: RARITY_NAMES[rarity],
        hint: 'Admin must keep at least one active template per scout rarity.',
      });
    }

    const overwall = rollScoutOverwall(rarity, rand);
    let position = template.position;
    if (position < 0 || position > 4) position = 0;
    if (rand() < SCOUT_LATERAL_CHANCE) position = 4;

    return { rarity, overwall, position, template };
  }

  async mint(userId: string, input: MintInput) {
    await this.clubService.getClub(userId);

    const { discountPct, weights, costGmt } = await this.getScoutTuning();
    const unitCost = parseFloat((costGmt * (1 - discountPct)).toFixed(4));
    const minimumCost = parseFloat((unitCost * input.quantity).toFixed(4));
    const current = await this.clubService.getMgtBalance(userId);
    if (current < minimumCost) {
      throw new AppError(ErrorCode.INSUFFICIENT_GMT, 400, { required: minimumCost, current });
    }

    let charged = 0;
    const rows = await this.repo.mintPlayers(userId, minimumCost, unitCost, input.quantity, async () => {
      const { rarity, overwall, position, template } = await this.rollOne(secureRandom, weights);
      const mintSeed = `${userId}:${template.id}:${rarity}:${overwall}:${secureRandom()}`;
      const name = isPlaceholderPlayerName(template.name)
        ? generatePlayerDisplayName(mintSeed)
        : template.name;
      const mintCostGmt = unitCost;
      charged += mintCostGmt;
      return {
        rarity,
        overwall,
        position,
        name,
        imageUrl: template.imageUrl,
        templateId: template.id,
        mintCostGmt,
      };
    });

    const created = rows.map((row) => {
      const rarityIdx = row.rarity;
      const costBasisUsdc = unitCost;
      const ageInfo = playerAgeFromRoi(costBasisUsdc, 0);
      return {
        id: row.id,
        rarity: RARITY_NAMES[rarityIdx]!,
        overwall: row.overwall,
        position: POSITION_NAMES[row.position]!,
        name: row.name ?? null,
        imageUrl: row.imageUrl ?? null,
        age: ageInfo.age,
        costBasisUsdc,
        attributes: readPlayerAttributes(row.attributes, row.id, rarityIdx, row.position),
      };
    });
    const totalCost = parseFloat(charged.toFixed(4));

    await this.passService?.addXp(userId, GAME_CONFIG.PASS_XP.scoutMint * input.quantity);

    return { players: created, cost: totalCost };
  }
}
