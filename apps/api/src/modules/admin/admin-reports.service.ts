import type { Prisma, PrismaClient } from '@prisma/client';
import type { AdminForecastDTO, AdminLedgerRowDTO, AdminReportSummaryDTO } from '@mll/shared';

// ─── Statistical helpers ────────────────────────────────────────────────────

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Trimmed mean: remove `trimPct` fraction from each tail, average the rest. */
function trimmedMean(arr: number[], trimPct = 0.10): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * trimPct);
  const trimmed = cut > 0 ? sorted.slice(cut, -cut) : sorted;
  if (trimmed.length === 0) return sorted[Math.floor(sorted.length / 2)];
  return trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
}

/**
 * Exponential Weighted Moving Average, most-recent day = highest weight.
 * λ = decay factor (0.85 = recent days matter ~5–6× more than 14 days ago).
 */
function ewma(arr: number[], lambda = 0.85): number {
  if (arr.length === 0) return 0;
  let weight = 1;
  let weightSum = 0;
  let valueSum = 0;
  // iterate newest → oldest: arr[arr.length-1] is most recent
  for (let i = arr.length - 1; i >= 0; i--) {
    valueSum += arr[i] * weight;
    weightSum += weight;
    weight *= lambda;
  }
  return valueSum / weightSum;
}

/** Median absolute deviation — used to express confidence. */
function mad(arr: number[], med: number): number {
  if (arr.length === 0) return 0;
  const devs = arr.map(v => Math.abs(v - med));
  return median(devs);
}

function buildForecast(dailyVolumes: number[]): AdminForecastDTO {
  const activeDays = dailyVolumes.filter(v => v > 0).length;
  const zeroDays   = dailyVolumes.filter(v => v === 0).length;

  // For forecasting we only consider ACTIVE days (days with transactions),
  // so zero-deposit days don't drag the estimate down artificially.
  // We then scale back by the activity rate to get a realistic daily projection.
  const actives = dailyVolumes.filter(v => v > 0);
  const activityRate = dailyVolumes.length > 0 ? activeDays / dailyVolumes.length : 1;

  const medianActive   = median(actives);
  const trimActive     = trimmedMean(actives, 0.10);
  const ewmaFull       = ewma(dailyVolumes, 0.85); // uses all days, recent-weighted

  // "Best estimate" per calendar day = active-day estimate × activity rate
  const medianDaily     = medianActive  * activityRate;
  const trimmedMeanDaily = trimActive   * activityRate;
  const ewmaDaily       = ewmaFull;  // ewma already includes zeros naturally

  // Best estimate = trimmedMean (outlier-resistant) — use as headline
  const best7d  = Math.max(0, trimmedMeanDaily  * 7);
  const best30d = Math.max(0, trimmedMeanDaily  * 30);

  // Confidence: how much do methods agree? (lower MAD relative to mean = higher confidence)
  const methods = [medianDaily, trimmedMeanDaily, ewmaDaily].filter(v => v > 0);
  const methodMean = methods.length ? methods.reduce((a, b) => a + b, 0) / methods.length : 0;
  const methodSpread = methods.length > 1
    ? Math.max(...methods) - Math.min(...methods)
    : 0;
  const confidencePct = methodMean > 0
    ? Math.max(0, Math.min(100, 100 - (methodSpread / methodMean) * 100))
    : 0;

  return {
    medianDaily,
    trimmedMeanDaily,
    ewmaDaily,
    best7d,
    best30d,
    confidencePct,
    activeDays,
    zeroDays,
  };
}

/** Per-transaction median (median ticket size, not daily volume). */
function txMedian(amounts: number[]): number {
  return median(amounts);
}

// ─── Service ────────────────────────────────────────────────────────────────

export class AdminReportsService {
  constructor(private readonly prisma: PrismaClient) {}

  private parseRange(from?: string, to?: string): Prisma.WalletTransactionWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = new Date(to);
    return Object.keys(createdAt).length ? { createdAt } : {};
  }

  private parseWithdrawalRange(from?: string, to?: string): Prisma.WithdrawalRequestWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = new Date(to);
    return Object.keys(createdAt).length ? { createdAt } : {};
  }

  async summary(from?: string, to?: string): Promise<AdminReportSummaryDTO> {
    const range = this.parseRange(from, to);
    const last30Start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [deposits, withdrawals, deps30, wds30] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { type: 'usdc_deposit', status: 'confirmed', ...range },
        select: { amount: true, userId: true, createdAt: true },
      }),
      this.prisma.withdrawalRequest.findMany({
        where: { status: 'completed', ...this.parseWithdrawalRange(from, to) },
        select: { amountUsdc: true, userId: true, createdAt: true, reviewedAt: true },
      }),
      this.prisma.walletTransaction.findMany({
        where: { type: 'usdc_deposit', status: 'confirmed', createdAt: { gte: last30Start } },
        select: { amount: true, userId: true, createdAt: true },
      }),
      this.prisma.withdrawalRequest.findMany({
        where: { status: 'completed', reviewedAt: { gte: last30Start } },
        select: { amountUsdc: true, userId: true, createdAt: true, reviewedAt: true },
      }),
    ]);

    // Normalize withdrawal rows (from withdrawalRequest) into the ledger shape used below,
    // using the payment date (reviewedAt) when available.
    const normWithdrawals = withdrawals.map(r => ({
      amount: Number(r.amountUsdc),
      userId: r.userId,
      createdAt: r.reviewedAt ?? r.createdAt,
    }));
    const normWds30 = wds30.map(r => ({
      amount: Number(r.amountUsdc),
      userId: r.userId,
      createdAt: r.reviewedAt ?? r.createdAt,
    }));

    const depAmounts = deposits.map(r => Math.abs(Number(r.amount)));
    const wdAmounts  = normWithdrawals.map(r => Math.abs(Number(r.amount)));
    const depVol = depAmounts.reduce((s, v) => s + v, 0);
    const wdVol  = wdAmounts.reduce((s, v) => s + v, 0);

    // Build 30-day daily buckets
    const depBuckets: Record<string, { volume: number; count: number }> = {};
    const wdBuckets:  Record<string, { volume: number; count: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(last30Start.getTime() + i * 86400000);
      const key = d.toISOString().slice(0, 10);
      depBuckets[key] = { volume: 0, count: 0 };
      wdBuckets[key]  = { volume: 0, count: 0 };
    }
    for (const r of deps30) {
      const key = r.createdAt.toISOString().slice(0, 10);
      if (depBuckets[key]) { depBuckets[key].volume += Math.abs(Number(r.amount)); depBuckets[key].count++; }
    }
    for (const r of normWds30) {
      const key = r.createdAt.toISOString().slice(0, 10);
      if (wdBuckets[key]) { wdBuckets[key].volume += Math.abs(Number(r.amount)); wdBuckets[key].count++; }
    }

    const dailyDeposits   = Object.entries(depBuckets).map(([date, v]) => ({ date, ...v }));
    const dailyWithdrawals = Object.entries(wdBuckets).map(([date, v]) => ({ date, ...v }));

    // Top depositors
    const topRaw: Record<string, { userId: string; total: number; count: number }> = {};
    for (const r of deposits) {
      if (!topRaw[r.userId]) topRaw[r.userId] = { userId: r.userId, total: 0, count: 0 };
      topRaw[r.userId].total += Math.abs(Number(r.amount));
      topRaw[r.userId].count++;
    }
    const topIds = Object.values(topRaw).sort((a, b) => b.total - a.total).slice(0, 10).map(x => x.userId);
    const topUsers = await this.prisma.user.findMany({
      where: { id: { in: topIds } },
      select: { id: true, username: true, email: true },
    });
    const userMap = Object.fromEntries(topUsers.map(u => [u.id, u]));
    const topDepositors = topIds.map(id => ({
      userId: id,
      username: userMap[id]?.username ?? null,
      email: userMap[id]?.email ?? null,
      total: topRaw[id].total,
      count: topRaw[id].count,
    }));

    return {
      depositCount: deposits.length,
      depositVolumeUsdc: depVol,
      withdrawalCount: normWithdrawals.length,
      withdrawalVolumeUsdc: wdVol,
      avgDepositUsdc:    depAmounts.length ? depVol / depAmounts.length : 0,
      avgWithdrawalUsdc: wdAmounts.length  ? wdVol / wdAmounts.length  : 0,
      medianDepositUsdc:    txMedian(depAmounts),
      medianWithdrawalUsdc: txMedian(wdAmounts),
      netUsdc: depVol - wdVol,
      uniqueDepositors:  new Set(deposits.map(r => r.userId)).size,
      uniqueWithdrawers: new Set(normWithdrawals.map(r => r.userId)).size,
      forecastDeposits:    buildForecast(dailyDeposits.map(d => d.volume)),
      forecastWithdrawals: buildForecast(dailyWithdrawals.map(d => d.volume)),
      dailyDeposits,
      dailyWithdrawals,
      topDepositors,
      from: from ?? null,
      to: to ?? null,
    };
  }

  async listDeposits(limit: number, cursor?: string, from?: string, to?: string, search?: string) {
    return this.listLedger('usdc_deposit', limit, cursor, from, to, search);
  }

  async listWithdrawals(limit: number, cursor?: string, from?: string, to?: string, search?: string) {
    const range = this.parseWithdrawalRange(from, to);

    let userIdFilter: string[] | undefined;
    if (search && search.trim().length >= 2) {
      const term = search.trim();
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: term, mode: 'insensitive' } },
            { username: { contains: term, mode: 'insensitive' } },
            { id: term.length === 36 ? term : undefined },
          ],
        },
        select: { id: true },
        take: 200,
      });
      userIdFilter = users.map(u => u.id);
      if (userIdFilter.length === 0) return { transactions: [], nextCursor: undefined };
    }

    const where: Prisma.WithdrawalRequestWhereInput = {
      ...range,
      ...(userIdFilter ? { userId: { in: userIdFilter } } : {}),
    };

    const rows = await this.prisma.withdrawalRequest.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, username: true } } },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const transactions: AdminLedgerRowDTO[] = items.map((r) => ({
      id: r.id,
      userId: r.userId,
      username: r.user.username,
      email: r.user.email,
      amountUsdc: Math.abs(Number(r.amountUsdc)),
      txHash: r.txHash ?? '—',
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));

    return { transactions, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
  }

  private async listLedger(
    type: string,
    limit: number,
    cursor?: string,
    from?: string,
    to?: string,
    search?: string,
  ) {
    const range = this.parseRange(from, to);

    let userIdFilter: string[] | undefined;
    if (search && search.trim().length >= 2) {
      const term = search.trim();
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: term, mode: 'insensitive' } },
            { username: { contains: term, mode: 'insensitive' } },
            { id: term.length === 36 ? term : undefined },
          ],
        },
        select: { id: true },
        take: 200,
      });
      userIdFilter = users.map(u => u.id);
      if (userIdFilter.length === 0) return { transactions: [], nextCursor: undefined };
    }

    const where: Prisma.WalletTransactionWhereInput = {
      type,
      ...range,
      ...(userIdFilter ? { userId: { in: userIdFilter } } : {}),
    };

    const rows = await this.prisma.walletTransaction.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, username: true } } },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const transactions: AdminLedgerRowDTO[] = items.map((r) => ({
      id: r.id,
      userId: r.userId,
      username: r.user.username,
      email: r.user.email,
      amountUsdc: Math.abs(Number(r.amount)),
      txHash: r.txHash,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));

    return { transactions, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
  }
}
