import type { PrismaClient } from '@prisma/client';
import type { PassLevelConfigDTO } from '@mll/shared';
import { DEFAULT_PASS_LEVELS, DEFAULT_PASS_MISSIONS } from '../../config/pass.js';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { normalizePassRewards } from './pass-reward.service.js';

/** A template must select real registered assets, just like a hand-built season. */
export async function getDefaultPassTemplate(prisma: PrismaClient) {
  const [cards, boots, stamina] = await Promise.all([
    prisma.itemTemplate.findMany({ where: { active: true }, orderBy: [{ rarity: 'asc' }, { name: 'asc' }, { id: 'asc' }] }),
    prisma.gearCatalogItem.findFirst({ where: { active: true, slot: 'boots', rarity: 1 }, orderBy: { sortOrder: 'asc' } }),
    prisma.stadiumShopItem.findFirst({ where: { active: true, effectType: 'stamina_full' }, orderBy: { sortOrder: 'asc' } }),
  ]);
  const used = new Map<number, number>();
  function selectCard(rarity: number) {
    const pool = cards.filter(card => card.rarity === rarity);
    const index = used.get(rarity) ?? 0;
    used.set(rarity, index + 1);
    return pool[index % pool.length];
  }
  function selected(level: PassLevelConfigDTO, type: 'catalog_item' | 'gear' | 'shop_item', item: { id: string } | null | undefined): PassLevelConfigDTO {
    if (!item) throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
      reason: 'pass_template_catalog_required', message: `Cadastre e ative o item necessário para o prêmio do nível ${level.level}, ou configure esse prêmio manualmente.`,
    });
    return { level: level.level, xpRequired: level.xpRequired, rewardType: type, rewardLabel: 'Item do catálogo', rewardItemId: item.id, quantity: 1 };
  }
  const levels = DEFAULT_PASS_LEVELS.map(level => {
    if (level.rewardType === 'usdc') return { ...level, rewardLabel: level.rewardLabel.replace(/USDC/g, 'GMT') };
    if (level.rewardType === 'player') return selected(level, 'catalog_item', selectCard(level.playerRarity ?? 0));
    if (level.rewardType === 'ticket') return selected(level, 'shop_item', stamina);
    if (level.rewardType === 'cosmetic') return level.level === 4 ? selected(level, 'gear', boots) : selected(level, 'catalog_item', selectCard(2));
    return level;
  });
  return { levels: await normalizePassRewards(prisma, levels), missions: DEFAULT_PASS_MISSIONS };
}
