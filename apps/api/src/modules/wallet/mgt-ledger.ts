import { Prisma, PrismaClient } from '@prisma/client';
import type { MgtTxTypeName, MoneyAsset } from '@mll/shared';
import { isBelowMinimum, MgtTxType, MONEY_MIN, quantizeMoney } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';

type TxClient = Prisma.TransactionClient | PrismaClient;
type LedgerCurrency = 'gmt' | 'usdc' | 'usdt';
type LedgerMovement = 'credit' | 'debit' | 'lock' | 'release' | 'settle';

const ORIGIN_BY_TYPE: Record<string, string> = {
  starter: 'starter',
  farm: 'farm',
  mining_claim: 'mining',
  marketplace_sell: 'marketplace',
  pass_claim: 'pass',
  referral: 'referral',
  event_reward: 'event',
  swap_usdc_to_gmt: 'swap',
  swap_usdt_to_gmt: 'swap',
  usdc_deposit: 'deposit',
  player_unstake: 'player_stake',
  pvp_refund: 'pvp',
  pvp_win: 'pvp',
  admin_adjust: 'admin',
};

const DESTINATION_BY_TYPE: Record<string, string> = {
  scout: 'scout',
  merge: 'merge',
  marketplace_buy: 'marketplace',
  upgrade: 'upgrade',
  pass_premium: 'pass',
  stadium_shop: 'stadium_shop',
  gear_shop: 'gear_shop',
  boneco: 'boneco',
  office_hire: 'office',
  office_fee: 'office',
  coach_fee: 'coach',
  stadium_license: 'stadium',
  player_stake: 'player_stake',
  player_unstake: 'player_stake',
  pvp_stake: 'pvp',
  usdc_withdraw: 'withdraw',
  usdt_withdraw: 'withdraw',
  swap_gmt_to_usdc: 'swap',
  admin_adjust: 'admin',
};

function ledgerMeta(
  type: string,
  currency: LedgerCurrency,
  movement: LedgerMovement,
  meta?: Record<string, unknown>,
): Prisma.InputJsonValue {
  const body: Record<string, unknown> = { currency, movement, ...(meta ?? {}) };
  const incoming = movement === 'credit' || movement === 'release';
  if (incoming && body.origin == null) body.origin = ORIGIN_BY_TYPE[type] ?? type;
  if (!incoming && body.destination == null) body.destination = DESTINATION_BY_TYPE[type] ?? type;
  return body as Prisma.InputJsonValue;
}

type LockedBalance = {
  amount: string;
  lockedAmount: string;
  usdcAmount: string;
  usdtAmount: string;
  usdtLockedAmount: string;
};

function postedAmount(asset: MoneyAsset, amount: number | string, kind: 'credit' | 'debit'): Prisma.Decimal | null {
  const probe = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(probe) || probe <= 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, kind === 'credit' ? 500 : 400, {
      reason: 'amount must be positive',
    });
  }
  const quantized = quantizeMoney(asset, amount);
  if (isBelowMinimum(asset, quantized)) {
    if (kind === 'debit') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
        reason: 'amount below minimum',
        asset,
        minimum: MONEY_MIN[asset],
      });
    }
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

async function lockBalance(tx: TxClient, userId: string): Promise<LockedBalance> {
  await ensureBalance(tx, userId);
  const rows = await tx.$queryRaw<LockedBalance[]>`
    SELECT "amount"::text AS amount,
           "lockedAmount"::text AS "lockedAmount",
           "usdcAmount"::text AS "usdcAmount",
           "usdtAmount"::text AS "usdtAmount",
           "usdtLockedAmount"::text AS "usdtLockedAmount"
    FROM "MGTBalance"
    WHERE "userId" = ${userId}
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 500, { reason: 'balance row missing' });
  }
  return row;
}

/** GMT credit (in-game `amount`). */
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
      meta: ledgerMeta(type, 'gmt', 'credit', meta),
    },
  });

  return Number(updated.amount);
}

/** GMT debit (in-game `amount`). Returns the ledger row so a mint can point at it. */
export async function applyMgtDebit(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  meta?: Record<string, unknown>,
): Promise<{ balanceAfter: number; transactionId: string }> {
  const posted = postedAmount('gmt', amount, 'debit');
  if (!posted) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'amount below minimum' });
  }

  const balance = await lockBalance(tx, userId);
  const current = new Prisma.Decimal(balance.amount);
  if (current.lt(posted)) {
    throw new AppError(ErrorCode.INSUFFICIENT_GMT, 400, { required: Number(posted), current: Number(current) });
  }

  const updated = await tx.mGTBalance.update({
    where: { userId },
    data: { amount: { decrement: posted } },
  });

  const entry = await tx.mGTTransaction.create({
    data: {
      userId,
      type,
      amount: posted.neg(),
      balanceAfter: updated.amount,
      meta: ledgerMeta(type, 'gmt', 'debit', meta),
    },
  });

  return { balanceAfter: Number(updated.amount), transactionId: entry.id };
}

/** USDC credit (vault `usdcAmount`). */
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
      meta: ledgerMeta(type, 'usdc', 'credit', meta),
    },
  });

  return Number(updated.usdcAmount);
}

/** USDC debit (vault `usdcAmount`). */
export async function applyUsdcDebit(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  meta?: Record<string, unknown>,
): Promise<number> {
  const posted = postedAmount('usdc', amount, 'debit');
  if (!posted) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'amount below minimum' });
  }

  await ensureBalance(tx, userId);

  const balance = await tx.mGTBalance.findUnique({ where: { userId } });
  const current = new Prisma.Decimal(balance?.usdcAmount ?? 0);
  if (!balance || current.lt(posted)) {
    throw new AppError(ErrorCode.INSUFFICIENT_USDC, 400, { required: Number(posted), current: Number(current) });
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
      meta: ledgerMeta(type, 'usdc', 'debit', meta),
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
      meta: ledgerMeta(type, 'usdt', 'credit', meta),
    },
  });

  return Number(updated.usdtAmount);
}

/** USDT debit (vault `usdtAmount`) — saques. */
export async function applyUsdtDebit(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  meta?: Record<string, unknown>,
): Promise<number> {
  const posted = postedAmount('usdt', amount, 'debit');
  if (!posted) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'amount below minimum' });
  }

  await ensureBalance(tx, userId);

  const balance = await tx.mGTBalance.findUnique({ where: { userId } });
  const current = new Prisma.Decimal(balance?.usdtAmount ?? 0);
  if (!balance || current.lt(posted)) {
    throw new AppError(ErrorCode.INSUFFICIENT_USDT, 400, { required: Number(posted), current: Number(current) });
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
      meta: ledgerMeta(type, 'usdt', 'debit', meta),
    },
  });

  return Number(updated.usdtAmount);
}

export type MergePaymentCurrency = 'usdc' | 'gmt';

/** Debit merge fee in GMT (USDC path kept for legacy callers; prefer defaults to gmt). */
export async function applyMergeFeeDebit(
  tx: TxClient,
  userId: string,
  amount: number | string,
  meta?: Record<string, unknown>,
  prefer: MergePaymentCurrency | 'auto' = 'gmt',
): Promise<{ currency: MergePaymentCurrency; balanceAfter: number; transactionId: string | null }> {
  await ensureBalance(tx, userId);
  const balance = await tx.mGTBalance.findUnique({ where: { userId } });
  const usdcBal = new Prisma.Decimal(balance?.usdcAmount ?? 0);
  const gmtBal = new Prisma.Decimal(balance?.amount ?? 0);
  const usdcRequired = new Prisma.Decimal(quantizeMoney('usdc', amount));
  const gmtRequired = new Prisma.Decimal(quantizeMoney('gmt', amount));

  if (prefer === 'usdc') {
    if (usdcBal.lt(usdcRequired)) {
      throw new AppError(ErrorCode.INSUFFICIENT_USDC, 400, {
        required: usdcRequired.toString(),
        usdcBalance: usdcBal.toString(),
        gmtBalance: gmtBal.toString(),
      });
    }
    const balanceAfter = await applyUsdcDebit(tx, userId, amount, MgtTxType.MERGE, meta);
    return { currency: 'usdc', balanceAfter, transactionId: null };
  }

  if (prefer === 'gmt') {
    if (gmtBal.lt(gmtRequired)) {
      throw new AppError(ErrorCode.INSUFFICIENT_GMT, 400, {
        required: gmtRequired.toString(),
        current: gmtBal.toString(),
      });
    }
    const { balanceAfter, transactionId } = await applyMgtDebit(tx, userId, amount, MgtTxType.MERGE, meta);
    return { currency: 'gmt', balanceAfter, transactionId };
  }

  if (usdcBal.gte(usdcRequired)) {
    const balanceAfter = await applyUsdcDebit(tx, userId, amount, MgtTxType.MERGE, meta);
    return { currency: 'usdc', balanceAfter, transactionId: null };
  }
  if (gmtBal.gte(gmtRequired)) {
    const { balanceAfter, transactionId } = await applyMgtDebit(tx, userId, amount, MgtTxType.MERGE, meta);
    return { currency: 'gmt', balanceAfter, transactionId };
  }

  throw new AppError(ErrorCode.INSUFFICIENT_USDC, 400, {
    required: gmtRequired.toString(),
    usdcBalance: usdcBal.toString(),
    gmtBalance: gmtBal.toString(),
  });
}

export async function recordStarterMgt(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number | string,
): Promise<void> {
  await tx.mGTTransaction.create({
    data: {
      userId,
      type: 'starter',
      amount: new Prisma.Decimal(quantizeMoney('gmt', amount)),
      balanceAfter: new Prisma.Decimal(quantizeMoney('gmt', amount)),
      meta: ledgerMeta('starter', 'gmt', 'credit'),
    },
  });
}

export async function getBalances(tx: TxClient, userId: string) {
  await ensureBalance(tx, userId);
  const row = await tx.mGTBalance.findUnique({ where: { userId } });
  return {
    gmtBalance: Number(row?.amount ?? 0),
    gmtLocked: Number(row?.lockedAmount ?? 0),
    usdcBalance: Number(row?.usdcAmount ?? 0),
    usdtBalance: Number(row?.usdtAmount ?? 0),
    usdtLocked: Number(row?.usdtLockedAmount ?? 0),
  };
}

async function moveLocked(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  currency: 'gmt' | 'usdt',
  movement: 'lock' | 'release' | 'settle',
  meta?: Record<string, unknown>,
): Promise<{ balanceAfter: number; lockedAfter: number }> {
  const posted = postedAmount(currency, amount, 'debit');
  if (!posted) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'amount below minimum' });
  }

  const row = await lockBalance(tx, userId);
  const available = new Prisma.Decimal(currency === 'gmt' ? row.amount : row.usdtAmount);
  const locked = new Prisma.Decimal(currency === 'gmt' ? row.lockedAmount : row.usdtLockedAmount);
  if (movement === 'lock' && available.lt(posted)) {
    throw new AppError(currency === 'gmt' ? ErrorCode.INSUFFICIENT_GMT : ErrorCode.INSUFFICIENT_USDT, 400, {
      required: Number(posted),
      current: Number(available),
    });
  }
  if (movement !== 'lock' && locked.lt(posted)) {
    throw new AppError(currency === 'gmt' ? ErrorCode.INSUFFICIENT_GMT : ErrorCode.INSUFFICIENT_USDT, 400, {
      required: Number(posted),
      current: Number(locked),
    });
  }

  const availableField = currency === 'gmt' ? 'amount' : 'usdtAmount';
  const lockedField = currency === 'gmt' ? 'lockedAmount' : 'usdtLockedAmount';
  const updated = await tx.mGTBalance.update({
    where: { userId },
    data: {
      [availableField]: movement === 'settle' ? undefined : { [movement === 'lock' ? 'decrement' : 'increment']: posted },
      [lockedField]: { [movement === 'lock' ? 'increment' : 'decrement']: posted },
    },
  });

  const balanceAfter = Number(currency === 'gmt' ? updated.amount : updated.usdtAmount);
  const lockedAfter = Number(currency === 'gmt' ? updated.lockedAmount : updated.usdtLockedAmount);
  await tx.mGTTransaction.create({
    data: {
      userId,
      type,
      amount: movement === 'release' ? posted : posted.neg(),
      balanceAfter: currency === 'gmt' ? updated.amount : updated.usdtAmount,
      meta: ledgerMeta(type, currency, movement, { ...meta, lockedAfter }),
    },
  });

  return { balanceAfter, lockedAfter };
}

export function lockGmt(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  meta?: Record<string, unknown>,
) {
  return moveLocked(tx, userId, amount, type, 'gmt', 'lock', meta);
}

export function releaseGmt(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  meta?: Record<string, unknown>,
) {
  return moveLocked(tx, userId, amount, type, 'gmt', 'release', meta);
}

export function settleLockedGmt(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  meta?: Record<string, unknown>,
) {
  return moveLocked(tx, userId, amount, type, 'gmt', 'settle', meta);
}

export function lockUsdt(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  meta?: Record<string, unknown>,
) {
  return moveLocked(tx, userId, amount, type, 'usdt', 'lock', meta);
}

export function releaseUsdt(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  meta?: Record<string, unknown>,
) {
  return moveLocked(tx, userId, amount, type, 'usdt', 'release', meta);
}

export function settleLockedUsdt(
  tx: TxClient,
  userId: string,
  amount: number | string,
  type: MgtTxTypeName,
  meta?: Record<string, unknown>,
) {
  return moveLocked(tx, userId, amount, type, 'usdt', 'settle', meta);
}
