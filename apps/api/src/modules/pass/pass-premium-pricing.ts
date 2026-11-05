import { Prisma } from '@prisma/client';
import { quantizeMoney, type PassPremiumPricingDTO } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';

const DISCOUNT_PER_MILESTONE_GMT = 5;
const MILESTONES = [25, 50, 75, 100] as const;

/** Discount depends on unlocked season levels, never claimed rewards or client input. */
export function calculatePassPremiumPricing(
  basePriceGmt: number,
  xp: number,
  levels: ReadonlyArray<{ xpRequired: number }>,
): PassPremiumPricingDTO {
  if (!Number.isFinite(basePriceGmt) || basePriceGmt < 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'invalid_pass_price' });
  }
  const base = new Prisma.Decimal(quantizeMoney('gmt', basePriceGmt));
  const earnedXp = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  const totalLevels = levels.length;
  const completedLevels = levels.filter(entry => earnedXp >= entry.xpRequired).length;
  const milestonesReached = totalLevels ? Math.floor(completedLevels * 4 / totalLevels) : 0;
  const discount = Prisma.Decimal.min(base, milestonesReached * DISCOUNT_PER_MILESTONE_GMT);
  return {
    currency: 'GMT',
    basePriceGmt: Number(base),
    discountGmt: Number(discount),
    priceGmt: Number(base.sub(discount)),
    completedLevels,
    totalLevels,
    completionPct: totalLevels ? Math.floor(completedLevels * 10000 / totalLevels) / 100 : 0,
    milestones: MILESTONES.map((completionPct, index) => ({
      completionPct,
      requiredLevels: Math.ceil(totalLevels * completionPct / 100),
      discountGmt: Number(Prisma.Decimal.min(base, (index + 1) * DISCOUNT_PER_MILESTONE_GMT)),
      reached: totalLevels > 0 && completedLevels * 4 >= totalLevels * (index + 1),
    })),
  };
}
