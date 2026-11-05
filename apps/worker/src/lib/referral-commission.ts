import { Prisma, type PrismaClient } from '@prisma/client';
import {
  collectReferrerAncestors,
  depositCommission,
  MgtTxType,
  partyIsBanned,
  referralLoopReason,
  referralSelfReason,
  type ReferralRejectReason,
} from '@mll/shared';
import { applyUsdtCredit } from './mgt-ledger.js';

type Tx = Prisma.TransactionClient;

function history(status: string, reason: ReferralRejectReason | null) {
  return [{ at: new Date().toISOString(), status, reason }] as Prisma.InputJsonValue;
}

async function parentOf(tx: Tx, userId: string): Promise<string | null> {
  const row = await tx.referral.findUnique({
    where: { referredId: userId },
    select: { referrerId: true },
  });
  return row?.referrerId ?? null;
}

/**
 * Pay 5% of a confirmed USDC deposit to the referrer as withdrawable USDT.
 * A repeated hash does nothing. A blocked pair is recorded and not credited.
 */
export async function settleDepositReferral(
  tx: Tx,
  input: { referredId: string; gross: number | string; txHash: string },
): Promise<void> {
  const purchaseType = 'usdc_deposit';
  const existing = await tx.referralCommission.findUnique({
    where: { purchaseType_purchaseRef: { purchaseType, purchaseRef: input.txHash } },
  });
  if (existing) return;

  const link = await tx.referral.findUnique({ where: { referredId: input.referredId } });
  if (!link) return;

  const [referrer, referred] = await Promise.all([
    tx.user.findUnique({ where: { id: link.referrerId } }),
    tx.user.findUnique({ where: { id: input.referredId } }),
  ]);
  if (!referrer || !referred) return;

  const cfg = await tx.platformConfig.findUnique({ where: { id: 'default' } });
  const rate = cfg ? Number(cfg.referralBonusPct) : 0.05;
  const split = depositCommission(input.gross, rate);
  const ancestors = await collectReferrerAncestors(referrer.id, (id) => parentOf(tx, id));
  const reason: ReferralRejectReason | null =
    referralSelfReason(referrer, referred)
    ?? (partyIsBanned(referrer) || partyIsBanned(referred) ? 'banned' : null)
    ?? referralLoopReason(ancestors, referred.id)
    ?? (split.belowMinimum ? 'below_minimum' : null);

  const status = reason ? 'rejected' : 'credited';
  await tx.referralCommission.create({
    data: {
      referrerId: referrer.id,
      referredId: referred.id,
      purchaseType,
      purchaseRef: input.txHash,
      grossAmount: new Prisma.Decimal(split.gross),
      rate: new Prisma.Decimal(rate),
      commissionAmount: new Prisma.Decimal(reason ? '0.000000' : split.commission),
      currency: 'usdt',
      status,
      history: history(status, reason),
    },
  });

  if (reason) return;

  await applyUsdtCredit(tx, referrer.id, split.commission, MgtTxType.REFERRAL, {
    referredId: referred.id,
    sourceAmount: split.gross,
    txHash: input.txHash,
    movement: 'credit',
    origin: 'referral_deposit',
  });
}
