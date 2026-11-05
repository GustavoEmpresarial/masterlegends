import { Prisma, type PrismaClient } from '@prisma/client';
import type { MgtTxTypeName, MoneyAsset } from '@mll/shared';
import { isBelowMinimum, quantizeMoney } from '@mll/shared';

type TxClient = Prisma.TransactionClient | PrismaClient;

function postedAmount(asset: MoneyAsset, amount: number | string, kind: 'credit' | 'debit'): Prisma.Decimal | null {
  const probe = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(probe) || probe <= 0) {
    throw new Error('amount must be positive');
  }
  const quantized = quantizeMoney(asset, amount);
  if (isBelowMinimum(asset, quantized)) {
    if (kind === 'debit') throw new Error('amount below minimum');
    return null;
  }
  return new Prisma.Decimal(quantized);
}

async function ensureBalance(tx: TxClient, userId: string) {
  await tx.mGTBalance.upsert({
    where: { userId },
    create: { userId, amount: 0, usdcAmount: 0, usdtAmount: 0 },
    update: {},
  });
}

export async function applyMgtCredit(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  meta?: Record<string, unknown>,
): Promise<number> {
  const posted = postedAmount('gmt', amount, 'credit');
  if (!posted) {
    const row = await tx.mGTBalance.findUnique({ where: { userId } });
    return Number(row?.amount ?? 0);
  }

  await ensureBalance(tx, userId);

  const updated = await tx.mGTBalance.update({
    where: { userId },
    data: { amount: { increment: posted } },
  });

  await tx.mGTTransaction.create({
    data: {
      userId,
      type,
      amount: posted,
      balanceAfter: updated.amount,
      meta: meta ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  return Number(updated.amount);
}

export async function applyUsdcCredit(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  meta?: Record<string, unknown>,
): Promise<number> {
  const posted = postedAmount('usdc', amount, 'credit');
  if (!posted) {
    const row = await tx.mGTBalance.findUnique({ where: { userId } });
    return Number(row?.usdcAmount ?? 0);
  }

  await ensureBalance(tx, userId);

  const updated = await tx.mGTBalance.update({
    where: { userId },
    data: { usdcAmount: { increment: posted } },
  });

  await tx.mGTTransaction.create({
    data: {
      userId,
      type,
      amount: posted,
      balanceAfter: updated.usdcAmount,
      meta: meta ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  return Number(updated.usdcAmount);
}

/** USDT credit (vault `usdtAmount`) — ganhos de mineração / recompensas sacáveis. */
export async function applyUsdtCredit(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  meta?: Record<string, unknown>,
): Promise<number> {
  const posted = postedAmount('usdt', amount, 'credit');
  if (!posted) {
    const row = await tx.mGTBalance.findUnique({ where: { userId } });
    return Number(row?.usdtAmount ?? 0);
  }

  await ensureBalance(tx, userId);

  const updated = await tx.mGTBalance.update({
    where: { userId },
    data: { usdtAmount: { increment: posted } },
  });

  await tx.mGTTransaction.create({
    data: {
      userId,
      type,
      amount: posted,
      balanceAfter: updated.usdtAmount,
      meta: meta
        ? ({ currency: 'usdt', ...meta } as Prisma.InputJsonValue)
        : ({ currency: 'usdt' } as Prisma.InputJsonValue),
    },
  });

  return Number(updated.usdtAmount);
}

/** USDT debit (vault `usdtAmount`). Caller must ensure sufficient balance. */
export async function applyUsdtDebit(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  meta?: Record<string, unknown>,
): Promise<number> {
  const posted = postedAmount('usdt', amount, 'debit');
  if (!posted) throw new Error('amount below minimum');

  await ensureBalance(tx, userId);

  const balance = await tx.mGTBalance.findUnique({ where: { userId } });
  const current = new Prisma.Decimal(balance?.usdtAmount ?? 0);
  if (!balance || current.lt(posted)) {
    throw new Error(`insufficient USDT: required=${posted.toString()} current=${current.toString()}`);
  }

  const updated = await tx.mGTBalance.update({
    where: { userId },
    data: { usdtAmount: { decrement: posted } },
  });

  await tx.mGTTransaction.create({
    data: {
      userId,
      type,
      amount: posted.neg(),
      balanceAfter: updated.usdtAmount,
      meta: meta
        ? ({ currency: 'usdt', ...meta } as Prisma.InputJsonValue)
        : ({ currency: 'usdt' } as Prisma.InputJsonValue),
    },
  });

  return Number(updated.usdtAmount);
}

/** USDC debit (vault `usdcAmount`). Caller must ensure sufficient balance. */
export async function applyUsdcDebit(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  meta?: Record<string, unknown>,
): Promise<number> {
  const posted = postedAmount('usdc', amount, 'debit');
  if (!posted) throw new Error('amount below minimum');

  await ensureBalance(tx, userId);

  const balance = await tx.mGTBalance.findUnique({ where: { userId } });
  const current = new Prisma.Decimal(balance?.usdcAmount ?? 0);
  if (!balance || current.lt(posted)) {
    throw new Error(`insufficient USDC: required=${posted.toString()} current=${current.toString()}`);
  }

  const updated = await tx.mGTBalance.update({
    where: { userId },
    data: { usdcAmount: { decrement: posted } },
  });

  await tx.mGTTransaction.create({
    data: {
      userId,
      type,
      amount: posted.neg(),
      balanceAfter: updated.usdcAmount,
      meta: meta
        ? ({ currency: 'usdc', ...meta } as Prisma.InputJsonValue)
        : ({ currency: 'usdc' } as Prisma.InputJsonValue),
    },
  });

  return Number(updated.usdcAmount);
}
