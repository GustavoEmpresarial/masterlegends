import type { Prisma, PrismaClient } from '@prisma/client';
import { findRewardBlockForLevel, MgtTxType, type PassLevelConfigDTO, type PassRewardBlockDTO, type PassRewardCatalogItemDTO } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { applyMgtCredit } from '../wallet/mgt-ledger.js';
import { POSITION_NAMES } from '../../config/game.js';
import type { ConfiguredPassSeason } from './pass-season.service.js';

type Reward = PassLevelConfigDTO | PassRewardBlockDTO;
const rarities = ['Comum', 'Incomum', 'Raro', 'Super Raro', 'Épico', 'Lendário'];

export async function getPassRewardCatalog(prisma: PrismaClient): Promise<PassRewardCatalogItemDTO[]> {
  const [cards, gear, shop] = await Promise.all([
    prisma.itemTemplate.findMany({ where: { active: true }, orderBy: [{ rarity: 'asc' }, { name: 'asc' }] }),
    prisma.gearCatalogItem.findMany({ where: { active: true }, orderBy: [{ rarity: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.stadiumShopItem.findMany({ where: { active: true, effectType: { in: ['stamina_full', 'stamina_flat'] } }, orderBy: { sortOrder: 'asc' } }),
  ]);
  return [
    ...cards.map(item => ({ id: item.id, rewardType: 'catalog_item' as const, name: item.name, imageUrl: item.imageUrl,
      description: `${rarities[item.rarity] ?? item.rarity} · ${POSITION_NAMES[item.position] ?? item.position} · ${item.overwall} de poder · Almoxarifado` })),
    ...gear.map(item => ({ id: item.id, rewardType: 'gear' as const, name: item.nameKey, imageUrl: item.imageUrl,
      description: `${rarities[item.rarity] ?? item.rarity} · Bônus: +${item.owBonus} · Mochila de equipamentos` })),
    ...shop.map(item => ({ id: item.id, rewardType: 'shop_item' as const, name: item.nameKey, imageUrl: item.imageUrl,
      description: `${item.effectType === 'stamina_full' ? 'Recuperação total de stamina' : `+${item.effectValue} stamina`} · Almoxarifado` })),
  ];
}

/** Resolve IDs on the server. The editor cannot invent an item image, identity or reward. */
export async function normalizePassRewards<T extends Reward>(prisma: PrismaClient, rewards: T[]): Promise<T[]> {
  const catalog = await getPassRewardCatalog(prisma);
  const apply = <T extends { rewardType: string; rewardLabel: string; usdcAmount?: number; rewardItemId?: string; quantity?: number; rewardImageUrl?: string | null }>(reward: T): T => {
    if (['player', 'cosmetic', 'ticket'].includes(reward.rewardType)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'pass_reward_unavailable', message: 'Selecione uma carta cadastrada no catálogo, um equipamento, stamina ou saldo GMT.' });
    }
    if (reward.rewardType === 'usdc' && !(Number(reward.usdcAmount) > 0)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'pass_reward_amount_required', message: 'Informe um valor maior que zero para o prêmio em saldo.' });
    }
    if (!['catalog_item', 'gear', 'shop_item'].includes(reward.rewardType)) return reward;
    const item = catalog.find(item => item.rewardType === reward.rewardType && item.id === reward.rewardItemId);
    if (!item) throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'pass_reward_item_unavailable', message: 'Um dos prêmios foi removido ou desativado. Selecione outro item do catálogo.' });
    return { ...reward, rewardLabel: `${reward.quantity ?? 1}× ${item.name}`.slice(0, 128), rewardImageUrl: item.imageUrl };
  };
  return rewards.map(reward => {
    const next = apply(reward);
    if (!('goldReward' in reward) || !reward.goldReward) return next;
    return { ...next, goldReward: apply(reward.goldReward) };
  });
}

export const PASS_GOLD_CLAIM_OFFSET = 1000;

export function passClaimMarker(level: number, track: 'free' | 'gold'): number {
  return track === 'gold' ? level + PASS_GOLD_CLAIM_OFFSET : level;
}

async function deliver(
  tx: Prisma.TransactionClient,
  userId: string,
  seasonId: number,
  level: number,
  reward: { rewardType: string; usdcAmount?: number; rewardItemId?: string; quantity?: number },
  track: 'free' | 'gold',
) {
  const quantity = reward.quantity ?? 1;
  const sourceRef = track === 'gold' ? `pass:${seasonId}:${level}:gold` : `pass:${seasonId}:${level}`;
  if (reward.rewardType === 'usdc') {
    await applyMgtCredit(tx, userId, reward.usdcAmount ?? 0, MgtTxType.PASS_CLAIM, { seasonId, level });
    return;
  }
  if (reward.rewardType === 'gear') {
    const item = await tx.gearCatalogItem.findUnique({ where: { id: reward.rewardItemId! } });
    if (!item) throw new AppError(ErrorCode.GEAR_NOT_FOUND, 404);
    await tx.userGear.createMany({ data: Array.from({ length: quantity }, () => ({ userId, catalogItemId: item.id, source: 'pass' })) });
    return;
  }
  if (reward.rewardType === 'catalog_item' || reward.rewardType === 'shop_item') {
    const card = reward.rewardType === 'catalog_item' ? await tx.itemTemplate.findUnique({ where: { id: reward.rewardItemId! } }) : null;
    const shop = reward.rewardType === 'shop_item' ? await tx.stadiumShopItem.findUnique({ where: { id: reward.rewardItemId! } }) : null;
    if ((!card && !shop) || (shop && !['stamina_full', 'stamina_flat'].includes(shop.effectType))) {
      throw new AppError(ErrorCode.SHOP_ITEM_NOT_FOUND, 404);
    }
    const data = card ? { templateId: card.id, overwall: card.overwall, position: card.position }
      : { effectValue: shop!.effectType === 'stamina_full' ? 100 : shop!.effectValue, effectType: shop!.effectType };
    // One warehouse record per unit: consuming one cannot accidentally consume the whole prize stack.
    await tx.warehouseItem.createMany({ data: Array.from({ length: quantity }, () => ({
      userId, itemType: card ? 'player_card' : 'stamina_boost', name: card?.name ?? shop!.nameKey,
      imageUrl: card?.imageUrl ?? shop?.imageUrl, rarity: card?.rarity ?? 0,
      quantity: 1, data, source: 'pass', sourceRef,
    })) });
    return;
  }
  throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'pass_reward_unavailable' });
}

/** Row lock + delivery + claimed marker share one transaction, including rollback on delivery failure. */
export async function claimPassReward(
  prisma: PrismaClient,
  userId: string,
  season: ConfiguredPassSeason,
  level: number,
  track: 'free' | 'gold' = 'free',
) {
  const config = season.levels.find(entry => entry.level === level);
  if (!config) throw new AppError(ErrorCode.PASS_LEVEL_NOT_CLAIMABLE, 400);
  const marker = passClaimMarker(level, track);
  return prisma.$transaction(async tx => {
    await tx.passProgress.upsert({ where: { userId_seasonId: { userId, seasonId: season.id } }, create: { userId, seasonId: season.id, xp: 0 }, update: {} });
    await tx.$queryRaw`SELECT "userId" FROM "PassProgress" WHERE "userId" = ${userId} AND "seasonId" = ${season.id} FOR UPDATE`;
    const progress = await tx.passProgress.findUniqueOrThrow({ where: { userId_seasonId: { userId, seasonId: season.id } } });
    if (progress.claimedLevels.includes(marker)) throw new AppError(ErrorCode.PASS_ALREADY_CLAIMED, 400);
    const seasonOpen = season.startsAt <= new Date() && season.endsAt > new Date();
    if (!seasonOpen) throw new AppError(ErrorCode.PASS_LEVEL_NOT_CLAIMABLE, 400);
    if (track === 'gold') {
      if (!progress.premium) throw new AppError(ErrorCode.PASS_LEVEL_NOT_CLAIMABLE, 400);
    } else if (progress.xp < config.xpRequired) {
      throw new AppError(ErrorCode.PASS_LEVEL_NOT_CLAIMABLE, 400);
    }
    const reward = track === 'gold'
      ? config.goldReward
      : (findRewardBlockForLevel(level, season.rewardBlocks) ?? config);
    if (!reward) throw new AppError(ErrorCode.PASS_LEVEL_NOT_CLAIMABLE, 400);
    await deliver(tx, userId, season.id, level, reward, track);
    await tx.passProgress.update({ where: { userId_seasonId: { userId, seasonId: season.id } }, data: { claimedLevels: { push: marker } } });
  }, { timeout: 15000 });
}
