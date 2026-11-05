import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  WithdrawalHistoryChartsDTO,
  WithdrawalHistoryResponseDTO,
  WithdrawalHistorySummaryDTO,
  WithdrawalRequestDTO,
  AdminOverviewWithdrawalCardDTO,
} from '@mll/shared';
import { calcWithdrawAmounts, MgtTxType } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { PlatformConfigService } from '../platform/platform-config.service.js';
import { lockUsdt, releaseUsdt, settleLockedUsdt } from './mgt-ledger.js';
import { SatspayError, findSatspaySend, sendSatspayUsdt, usdtToSatspayUnits } from './satspay-client.js';

export type WithdrawalClientMeta = {
  ip?: string | null;
  userAgent?: string | null;
  satspayEmail?: string | null;
};

export type WithdrawalHistoryFilters = {
  status?: string;
  paymentMethod?: string;
  user?: string;
  email?: string;
  wallet?: string;
  hash?: string;
  q?: string;
  minAmount?: number;
  maxAmount?: number;
  from?: string;
  to?: string;
  period?: string;
  page?: number;
  limit?: number;
  sort?: string;
};

function parseUa(ua: string | null | undefined): { browser: string | null; os: string | null; device: string | null } {
  if (!ua) return { browser: null, os: null, device: null };
  const lower = ua.toLowerCase();
  let browser: string | null = null;
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('chrome/')) browser = 'Chrome';
  else if (lower.includes('firefox/')) browser = 'Firefox';
  else if (lower.includes('safari/') && !lower.includes('chrome')) browser = 'Safari';
  else if (lower.includes('opera') || lower.includes('opr/')) browser = 'Opera';

  let os: string | null = null;
  if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('android')) os = 'Android';
  else if (lower.includes('iphone') || lower.includes('ipad') || lower.includes('ios')) os = 'iOS';
  else if (lower.includes('mac os') || lower.includes('macintosh')) os = 'macOS';
  else if (lower.includes('linux')) os = 'Linux';

  let device: string | null = 'desktop';
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) device = 'mobile';
  else if (lower.includes('tablet') || lower.includes('ipad')) device = 'tablet';

  return { browser, os, device };
}

function mapRow(
  row: {
    id: string;
    userId: string;
    wallet: string;
    requestedUsdc: { toString(): string };
    feeUsdc: { toString(): string };
    amountUsdc: { toString(): string };
    currency: string;
    status: string;
    adminNote: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    txHash: string | null;
    satspayEmail?: string | null;
    metadata?: unknown;
    paymentMethod?: string | null;
    notes?: string | null;
    requestIp?: string | null;
    userAgent?: string | null;
    browser?: string | null;
    os?: string | null;
    device?: string | null;
    createdAt: Date;
    updatedAt?: Date;
    user?: { email: string | null; username: string | null } | null;
  },
): WithdrawalRequestDTO {
  return {
    id: row.id,
    userId: row.userId,
    username: row.user?.username ?? null,
    email: row.user?.email ?? null,
    wallet: row.wallet,
    requestedUsdc: Number(row.requestedUsdc),
    feeUsdc: Number(row.feeUsdc),
    amountUsdc: Number(row.amountUsdc),
    currency: row.currency,
    status: row.status,
    adminNote: row.adminNote,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    txHash: row.txHash,
    satspayEmail: row.satspayEmail ?? null,
    satspayError: satspayErrorOf(row.metadata),
    paymentMethod: row.paymentMethod ?? null,
    notes: row.notes ?? null,
    requestIp: row.requestIp ?? null,
    userAgent: row.userAgent ?? null,
    browser: row.browser ?? null,
    os: row.os ?? null,
    device: row.device ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

function satspayErrorOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const code = (metadata as { satspayError?: unknown }).satspayError;
  return typeof code === 'string' && code.trim() ? code : null;
}

function normalizeSatspayEmail(raw: string | null | undefined): string {
  const email = raw?.trim().toLowerCase() ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { field: 'satspayEmail' });
  }
  return email;
}

function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function resolvePeriodRange(filters: WithdrawalHistoryFilters): { from?: Date; to?: Date } {
  const now = new Date();
  const period = filters.period ?? 'all';
  if (period === 'today') {
    return { from: startOfLocalDay(now), to: now };
  }
  if (period === 'yesterday') {
    const y = startOfLocalDay(now);
    y.setDate(y.getDate() - 1);
    const end = startOfLocalDay(now);
    return { from: y, to: end };
  }
  if (period === '7d') {
    return { from: new Date(now.getTime() - 7 * 86400000), to: now };
  }
  if (period === '30d') {
    return { from: new Date(now.getTime() - 30 * 86400000), to: now };
  }
  const from = filters.from ? new Date(filters.from) : undefined;
  const to = filters.to ? new Date(filters.to) : undefined;
  if (to && filters.to && filters.to.length <= 10) {
    to.setHours(23, 59, 59, 999);
  }
  return {
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  };
}

export class WithdrawalRequestService {
  private readonly platform: PlatformConfigService;

  constructor(private readonly prisma: PrismaClient) {
    this.platform = new PlatformConfigService(prisma);
  }

  async createRequest(userId: string, amountUsdc: number, client?: WithdrawalClientMeta) {
    const cfg = await this.platform.get();
    if (cfg.withdrawalsPaused) {
      throw new AppError(ErrorCode.WITHDRAWALS_PAUSED, 400);
    }
    if (amountUsdc < cfg.minWithdrawUsdc) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
        min: cfg.minWithdrawUsdc,
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.wallet) {
      throw new AppError(ErrorCode.AUTH_WALLET_NOT_LINKED, 400);
    }
    if (!user.emailVerifiedAt) {
      throw new AppError(ErrorCode.AUTH_EMAIL_NOT_VERIFIED, 403);
    }
    if (user.bannedAt) {
      throw new AppError(ErrorCode.USER_BANNED, 403);
    }

    const feePct = cfg.withdrawFeePct ?? 0.05;
    const { fee, net: netUsdc } = calcWithdrawAmounts(amountUsdc, feePct);

    const ledger = await this.prisma.mGTBalance.findUnique({ where: { userId } });
    const available = Number(ledger?.usdtAmount ?? 0);
    if (available < amountUsdc) {
      throw new AppError(ErrorCode.INSUFFICIENT_VAULT_BALANCE, 400, {
        available,
        requested: amountUsdc,
      });
    }

    const satspayEmail = normalizeSatspayEmail(client?.satspayEmail);
    const ua = client?.userAgent?.slice(0, 512) ?? null;
    const parsed = parseUa(ua);
    const walletAddress = user.wallet.toLowerCase();

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.withdrawalRequest.create({
        data: {
          userId,
          wallet: walletAddress,
          requestedUsdc: amountUsdc,
          feeUsdc: fee,
          amountUsdc: netUsdc,
          currency: 'usdt',
          status: 'pending',
          paymentMethod: 'satspay',
          satspayEmail,
          requestIp: client?.ip?.slice(0, 64) ?? null,
          userAgent: ua,
          browser: parsed.browser,
          os: parsed.os,
          device: parsed.device,
        },
        include: { user: { select: { email: true, username: true } } },
      });
      await lockUsdt(tx, userId, amountUsdc, MgtTxType.USDT_WITHDRAW, {
        withdrawalId: created.id,
        wallet: walletAddress,
        netUsdt: netUsdc,
        feeUsdt: fee,
        destination: 'withdraw',
      });
      return created;
    });

    return mapRow(row);
  }

  async listForUser(userId: string) {
    const rows = await this.prisma.withdrawalRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { email: true, username: true } } },
    });
    return rows.map(mapRow);
  }

  async listAdmin(status?: string, limit = 50, cursor?: string) {
    const rows = await this.prisma.withdrawalRequest.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      where: status === 'pending'
        ? { status: { in: ['pending', 'sending'] } }
        : status
          ? { status }
          : undefined,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, username: true } } },
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map(mapRow),
      nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
    };
  }

  async getById(id: string) {
    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: { user: { select: { email: true, username: true } } },
    });
    if (!row) throw new AppError(ErrorCode.WITHDRAWAL_NOT_FOUND, 404);
    return mapRow(row);
  }

  /** Manual / MetaMask payout: admin confirms on-chain then marks completed. */
  async approve(
    id: string,
    adminLogin: string,
    txHash?: string | null,
    paymentMethod?: 'metamask' | 'manual' | null,
  ) {
    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: { user: { select: { email: true, username: true } } },
    });
    if (!row) throw new AppError(ErrorCode.WITHDRAWAL_NOT_FOUND, 404);
    if (row.status !== 'pending') {
      throw new AppError(ErrorCode.WITHDRAWAL_INVALID_STATE, 400);
    }
    if (row.satspayEmail) {
      throw new AppError(ErrorCode.WITHDRAWAL_INVALID_STATE, 400, { reason: 'satspay' });
    }

    const gross = Number(row.requestedUsdc);
    const net = Number(row.amountUsdc);
    const method =
      paymentMethod ??
      (txHash?.trim() ? 'metamask' : 'manual');

    await this.prisma.$transaction(async (tx) => {
      await settleLockedUsdt(tx, row.userId, gross, MgtTxType.USDT_WITHDRAW, {
        withdrawalId: row.id,
        wallet: row.wallet,
        netUsdt: net,
        feeUsdt: Number(row.feeUsdc),
        destination: 'withdraw',
      });

      await tx.withdrawalRequest.update({
        where: { id },
        data: {
          status: 'completed',
          reviewedBy: adminLogin,
          reviewedAt: new Date(),
          txHash: txHash?.trim() || null,
          paymentMethod: method,
        },
      });
    });

    const updated = await this.prisma.withdrawalRequest.findUniqueOrThrow({
      where: { id },
      include: { user: { select: { email: true, username: true } } },
    });
    return mapRow(updated);
  }

  /**
   * Admin click: send the net USDT to the SatsPay email, then settle the locked gross.
   * A refusal leaves the request pending and the USDT locked.
   */
  async sendViaSatspay(id: string, adminLogin: string) {
    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: { user: { select: { email: true, username: true } } },
    });
    if (!row) throw new AppError(ErrorCode.WITHDRAWAL_NOT_FOUND, 404);
    if (row.status === 'completed') return mapRow(row);
    if (row.status !== 'pending' && row.status !== 'sending') {
      throw new AppError(ErrorCode.WITHDRAWAL_INVALID_STATE, 400);
    }
    if (!row.satspayEmail || row.currency !== 'usdt') {
      throw new AppError(ErrorCode.WITHDRAWAL_INVALID_STATE, 400, { reason: 'not_satspay' });
    }

    if (row.status === 'pending') {
      const claim = await this.prisma.withdrawalRequest.updateMany({
        where: { id, status: 'pending' },
        data: { status: 'sending' },
      });
      if (claim.count === 0) {
        const current = await this.prisma.withdrawalRequest.findUnique({
          where: { id },
          include: { user: { select: { email: true, username: true } } },
        });
        if (current?.status === 'completed') return mapRow(current);
        if (current?.status !== 'sending') {
          throw new AppError(ErrorCode.WITHDRAWAL_INVALID_STATE, 400);
        }
      }
    }

    const gross = Number(row.requestedUsdc);
    const net = Number(row.amountUsdc);
    try {
      const existing = await findSatspaySend(id);
      const referenceId = existing?.referenceId
        ?? await sendSatspayUsdt({
          toEmail: row.satspayEmail,
          amountUnits: usdtToSatspayUnits(row.amountUsdc.toString()),
          idempotencyKey: id,
        });

      const finished = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.withdrawalRequest.updateMany({
          where: { id, status: 'sending' },
          data: {
            status: 'completed',
            reviewedBy: adminLogin,
            reviewedAt: new Date(),
            txHash: referenceId.slice(0, 66),
            paymentMethod: 'satspay',
            metadata: { satspayReferenceId: referenceId },
          },
        });
        if (claimed.count !== 1) return false;
        await settleLockedUsdt(tx, row.userId, gross, MgtTxType.USDT_WITHDRAW, {
          withdrawalId: row.id,
          wallet: row.wallet,
          netUsdt: net,
          feeUsdt: Number(row.feeUsdc),
          destination: 'withdraw',
          rail: 'satspay',
          satspayEmail: row.satspayEmail,
          referenceId,
        });
        return true;
      });

      const updated = await this.prisma.withdrawalRequest.findUniqueOrThrow({
        where: { id },
        include: { user: { select: { email: true, username: true } } },
      });
      if (!finished && updated.status !== 'completed') {
        throw new AppError(ErrorCode.WITHDRAWAL_INVALID_STATE, 400);
      }
      return mapRow(updated);
    } catch (err) {
      if (err instanceof AppError) throw err;
      const code = err instanceof SatspayError ? err.code : 'SEND_FAILED';
      const detail = err instanceof Error ? err.message : 'send failed';
      await this.prisma.withdrawalRequest.updateMany({
        where: { id, status: 'sending' },
        data: {
          status: 'pending',
          metadata: {
            satspayError: code,
            satspayErrorDetail: detail.slice(0, 300),
          },
        },
      });
      const current = await this.prisma.withdrawalRequest.findUnique({
        where: { id },
        include: { user: { select: { email: true, username: true } } },
      });
      if (current?.status === 'completed') return mapRow(current);
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
        satspayCode: code,
        message: detail.slice(0, 300),
      });
    }
  }

  async reject(id: string, adminLogin: string, reason: string) {
    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: { user: { select: { email: true, username: true } } },
    });
    if (!row) throw new AppError(ErrorCode.WITHDRAWAL_NOT_FOUND, 404);
    if (row.status !== 'pending') {
      throw new AppError(ErrorCode.WITHDRAWAL_INVALID_STATE, 400);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await releaseUsdt(tx, row.userId, Number(row.requestedUsdc), MgtTxType.USDT_WITHDRAW, {
        withdrawalId: row.id,
        wallet: row.wallet,
        origin: 'withdraw',
        reason,
      });
      return tx.withdrawalRequest.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedBy: adminLogin,
          reviewedAt: new Date(),
          adminNote: reason,
        },
        include: { user: { select: { email: true, username: true } } },
      });
    });
    return mapRow(updated);
  }

  private buildWhere(filters: WithdrawalHistoryFilters): Prisma.WithdrawalRequestWhereInput {
    const { from, to } = resolvePeriodRange(filters);
    const where: Prisma.WithdrawalRequestWhereInput = {};
    const and: Prisma.WithdrawalRequestWhereInput[] = [];

    if (filters.status && filters.status !== 'all') {
      where.status = filters.status;
    }
    if (filters.paymentMethod && filters.paymentMethod !== 'all') {
      where.paymentMethod = filters.paymentMethod;
    }
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    if (filters.minAmount != null || filters.maxAmount != null) {
      where.amountUsdc = {
        ...(filters.minAmount != null ? { gte: filters.minAmount } : {}),
        ...(filters.maxAmount != null ? { lte: filters.maxAmount } : {}),
      };
    }
    if (filters.wallet?.trim()) {
      where.wallet = { contains: filters.wallet.trim().toLowerCase(), mode: 'insensitive' };
    }
    if (filters.hash?.trim()) {
      where.txHash = { contains: filters.hash.trim(), mode: 'insensitive' };
    }

    if (filters.user?.trim()) {
      const q = filters.user.trim();
      and.push({
        OR: [
          { user: { username: { contains: q, mode: 'insensitive' } } },
          { userId: { equals: q } },
        ],
      });
    }
    if (filters.email?.trim()) {
      and.push({ user: { email: { contains: filters.email.trim(), mode: 'insensitive' } } });
    }
    if (filters.q?.trim()) {
      const q = filters.q.trim();
      and.push({
        OR: [
          { id: { equals: q } },
          { userId: { equals: q } },
          { wallet: { contains: q.toLowerCase(), mode: 'insensitive' } },
          { txHash: { contains: q, mode: 'insensitive' } },
          { user: { username: { contains: q, mode: 'insensitive' } } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    if (and.length) where.AND = and;

    return where;
  }

  async history(filters: WithdrawalHistoryFilters): Promise<WithdrawalHistoryResponseDTO> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
    const where = this.buildWhere(filters);

    let orderBy: Prisma.WithdrawalRequestOrderByWithRelationInput = { createdAt: 'desc' };
    if (filters.sort === 'createdAt_asc') orderBy = { createdAt: 'asc' };
    if (filters.sort === 'amount_desc') orderBy = { amountUsdc: 'desc' };
    if (filters.sort === 'amount_asc') orderBy = { amountUsdc: 'asc' };

    const chartWhere: Prisma.WithdrawalRequestWhereInput = {
      ...where,
      createdAt: {
        ...(typeof where.createdAt === 'object' && where.createdAt ? where.createdAt : {}),
        gte:
          (typeof where.createdAt === 'object' && where.createdAt && 'gte' in where.createdAt
            ? (where.createdAt.gte as Date | undefined)
            : undefined) ?? new Date(Date.now() - 90 * 86400000),
      },
    };

    const [total, rows, statsSample] = await Promise.all([
      this.prisma.withdrawalRequest.count({ where }),
      this.prisma.withdrawalRequest.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { email: true, username: true } } },
      }),
      this.prisma.withdrawalRequest.findMany({
        where: chartWhere,
        orderBy: { createdAt: 'desc' },
        take: 5000,
        select: {
          status: true,
          requestedUsdc: true,
          amountUsdc: true,
          createdAt: true,
          reviewedAt: true,
          userId: true,
          user: { select: { username: true, email: true } },
        },
      }),
    ]);

    const summary = this.computeSummary(statsSample);
    summary.count = total;
    const charts = this.computeCharts(statsSample);

    return {
      items: rows.map(mapRow),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      summary,
      charts,
    };
  }

  private computeSummary(
    rows: Array<{
      status: string;
      requestedUsdc: { toString(): string };
      amountUsdc: { toString(): string };
      createdAt: Date;
      reviewedAt: Date | null;
    }>,
  ): WithdrawalHistorySummaryDTO {
    let totalRequestedUsdc = 0;
    let totalPaidUsdc = 0;
    let totalPendingUsdc = 0;
    let totalRejectedUsdc = 0;
    let countPending = 0;
    let countPaid = 0;
    let countRejected = 0;
    const paidAmounts: number[] = [];
    const processMins: number[] = [];

    for (const r of rows) {
      const req = Number(r.requestedUsdc);
      const net = Number(r.amountUsdc);
      totalRequestedUsdc += req;
      if (r.status === 'pending') {
        countPending++;
        totalPendingUsdc += net;
      } else if (r.status === 'completed') {
        countPaid++;
        totalPaidUsdc += net;
        paidAmounts.push(net);
        if (r.reviewedAt) {
          processMins.push((r.reviewedAt.getTime() - r.createdAt.getTime()) / 60000);
        }
      } else if (r.status === 'rejected' || r.status === 'cancelled') {
        countRejected++;
        totalRejectedUsdc += net;
      }
    }

    return {
      count: rows.length,
      totalRequestedUsdc: round6(totalRequestedUsdc),
      totalPaidUsdc: round6(totalPaidUsdc),
      totalPendingUsdc: round6(totalPendingUsdc),
      totalRejectedUsdc: round6(totalRejectedUsdc),
      countPending,
      countPaid,
      countRejected,
      avgTicketUsdc: paidAmounts.length
        ? round6(paidAmounts.reduce((a, b) => a + b, 0) / paidAmounts.length)
        : null,
      maxPaidUsdc: paidAmounts.length ? round6(Math.max(...paidAmounts)) : null,
      minPaidUsdc: paidAmounts.length ? round6(Math.min(...paidAmounts)) : null,
      avgProcessMinutes: processMins.length
        ? round6(processMins.reduce((a, b) => a + b, 0) / processMins.length)
        : null,
    };
  }

  private computeCharts(
    rows: Array<{
      status: string;
      amountUsdc: { toString(): string };
      createdAt: Date;
      userId: string;
      user: { username: string | null; email: string | null } | null;
    }>,
  ): WithdrawalHistoryChartsDTO {
    const byDayMap = new Map<string, { count: number; paidUsdc: number }>();
    const byMonthMap = new Map<string, { count: number; paidUsdc: number }>();
    const statusMap = new Map<string, { count: number; amountUsdc: number }>();
    const userMap = new Map<
      string,
      { username: string | null; email: string | null; paidUsdc: number; count: number }
    >();

    for (const r of rows) {
      const day = r.createdAt.toISOString().slice(0, 10);
      const month = day.slice(0, 7);
      const net = Number(r.amountUsdc);
      const paid = r.status === 'completed' ? net : 0;

      const d = byDayMap.get(day) ?? { count: 0, paidUsdc: 0 };
      d.count++;
      d.paidUsdc += paid;
      byDayMap.set(day, d);

      const m = byMonthMap.get(month) ?? { count: 0, paidUsdc: 0 };
      m.count++;
      m.paidUsdc += paid;
      byMonthMap.set(month, m);

      const s = statusMap.get(r.status) ?? { count: 0, amountUsdc: 0 };
      s.count++;
      s.amountUsdc += net;
      statusMap.set(r.status, s);

      if (r.status === 'completed') {
        const u = userMap.get(r.userId) ?? {
          username: r.user?.username ?? null,
          email: r.user?.email ?? null,
          paidUsdc: 0,
          count: 0,
        };
        u.paidUsdc += net;
        u.count++;
        userMap.set(r.userId, u);
      }
    }

    const byDay = [...byDayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
      .map(([date, v]) => ({ date, count: v.count, paidUsdc: round6(v.paidUsdc) }));

    const byMonth = [...byMonthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, v]) => ({ month, count: v.count, paidUsdc: round6(v.paidUsdc) }));

    const statusBreakdown = [...statusMap.entries()].map(([status, v]) => ({
      status,
      count: v.count,
      amountUsdc: round6(v.amountUsdc),
    }));

    const topUsers = [...userMap.entries()]
      .map(([userId, v]) => ({
        userId,
        username: v.username,
        email: v.email,
        paidUsdc: round6(v.paidUsdc),
        count: v.count,
      }))
      .sort((a, b) => b.paidUsdc - a.paidUsdc)
      .slice(0, 10);

    return { byDay, byMonth, statusBreakdown, topUsers };
  }

  async overviewCard(): Promise<AdminOverviewWithdrawalCardDTO> {
    const now = new Date();
    const startToday = startOfLocalDay(now);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [requestedToday, paidTodayRows, pending, rejectedToday, paidMonth, recent] =
      await Promise.all([
        this.prisma.withdrawalRequest.count({ where: { createdAt: { gte: startToday } } }),
        this.prisma.withdrawalRequest.findMany({
          where: { status: 'completed', reviewedAt: { gte: startToday } },
          select: { amountUsdc: true },
        }),
        this.prisma.withdrawalRequest.count({ where: { status: 'pending' } }),
        this.prisma.withdrawalRequest.count({
          where: { status: 'rejected', reviewedAt: { gte: startToday } },
        }),
        this.prisma.withdrawalRequest.findMany({
          where: { status: 'completed', reviewedAt: { gte: startMonth } },
          select: { amountUsdc: true },
        }),
        this.prisma.withdrawalRequest.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { username: true } } },
        }),
      ]);

    const paidTodayUsdc = paidTodayRows.reduce((s, r) => s + Number(r.amountUsdc), 0);
    const paidMonthUsdc = paidMonth.reduce((s, r) => s + Number(r.amountUsdc), 0);

    return {
      requestedToday,
      paidToday: paidTodayRows.length,
      pending,
      rejectedToday,
      paidTodayUsdc: round6(paidTodayUsdc),
      paidMonthUsdc: round6(paidMonthUsdc),
      recent: recent.map((r) => ({
        id: r.id,
        username: r.user?.username ?? null,
        amountUsdc: Number(r.amountUsdc),
        currency: r.currency ?? 'usdt',
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        txHash: r.txHash,
      })),
    };
  }
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
