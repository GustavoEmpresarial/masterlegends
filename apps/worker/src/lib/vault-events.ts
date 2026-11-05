import { Prisma, type PrismaClient } from '@prisma/client';
import {
  ChainEvent,
  MgtTxType,
  WalletTxType,
  type ChainEventName,
} from '@mll/shared';
import type { Logger } from 'pino';
import { applyUsdcCredit } from './mgt-ledger.js';
import { settleDepositReferral } from './referral-commission.js';

export interface VaultEventPayload {
  user?: string;
  wallet?: string;
  amount: string | number | bigint;
  txHash: string;
  blockNumber?: string | number | bigint;
}

export async function processUsdcVaultEvent(
  prisma: PrismaClient,
  event: ChainEventName,
  data: VaultEventPayload,
  logger?: Logger,
): Promise<'credited' | 'already_credited' | 'skipped'> {
  const wallet = String(data.user ?? data.wallet ?? '').toLowerCase();
  const txHash = String(data.txHash ?? '').toLowerCase();
  const rawAmount = BigInt(String(data.amount));
  const amountUsdc = Number(rawAmount) / 1_000_000;

  if (!wallet || !txHash || !Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    return 'skipped';
  }

  const user = await prisma.user.findUnique({ where: { wallet } });
  if (!user) {
    return 'skipped';
  }

  const type =
    event === ChainEvent.UsdcDeposited ? WalletTxType.USDC_DEPOSIT : WalletTxType.USDC_WITHDRAW;
  const signedAmount = type === WalletTxType.USDC_WITHDRAW ? -amountUsdc : amountUsdc;

  const outcome = await prisma.$transaction(async (tx) => {
    const existing = await tx.walletTransaction.findUnique({ where: { txHash } });
    if (!existing) {
      const balance = await tx.mGTBalance.findUnique({ where: { userId: user.id } });
      if (!balance) {
        await tx.mGTBalance.create({ data: { userId: user.id, amount: 0, usdcAmount: 0 } });
      }

      await tx.walletTransaction.create({
        data: {
          userId: user.id,
          type,
          amount: new Prisma.Decimal(signedAmount),
          txHash,
          blockNumber: data.blockNumber != null ? BigInt(String(data.blockNumber)) : undefined,
          status: 'confirmed',
        },
      });

      if (type === WalletTxType.USDC_DEPOSIT) {
        await applyUsdcCredit(tx, user.id, amountUsdc, MgtTxType.USDC_DEPOSIT, { txHash });
      }
    }

    if (type === WalletTxType.USDC_DEPOSIT) {
      await settleDepositReferral(tx, { referredId: user.id, gross: amountUsdc, txHash });
      logger?.info(
        { event: 'referral.deposit_commission', referredId: user.id, txHash },
        'Deposit referral commission settled',
      );
    }

    return existing ? 'already_credited' as const : 'credited' as const;
  });

  return outcome;
}
