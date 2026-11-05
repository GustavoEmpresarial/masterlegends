import { Prisma, PrismaClient } from '@prisma/client';
import type { WalletTransactionsQuery } from '@mll/shared';

function resolveGameLedgerType(type: string, meta: unknown): string {
  if (type !== 'farm') return type;
  const source = (meta as Record<string, unknown> | null)?.source;
  if (source === 'mining_block' || source === 'mining_legacy_pending') {
    return 'mining_claim';
  }
  return type;
}

function decimalToNumber(value: Prisma.Decimal): number {
  return parseFloat(value.toString());
}

export class WalletRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findUserWallet(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { wallet: true },
    });
  }

  findUserByWallet(wallet: string) {
    return this.prisma.user.findUnique({
      where: { wallet: wallet.toLowerCase() },
      select: { id: true },
    });
  }

  getMgtBalance(userId: string) {
    return this.prisma.mGTBalance.findUnique({ where: { userId } });
  }

  findWalletTransactionByHash(txHash: string) {
    return this.prisma.walletTransaction.findUnique({ where: { txHash } });
  }

  getClubFarmMeta(userId: string) {
    return this.prisma.club.findUnique({
      where: { userId },
      select: { id: true, stadiumLvl: true, lastFarmAt: true, coachHiredAt: true, user: { select: { wallet: true } } },
    });
  }

  async upsertWalletTransaction(data: {
    userId: string;
    type: string;
    amount: number;
    txHash: string;
    blockNumber?: bigint;
  }) {
    return this.prisma.walletTransaction.upsert({
      where: { txHash: data.txHash },
      create: {
        userId: data.userId,
        type: data.type,
        amount: new Prisma.Decimal(data.amount),
        txHash: data.txHash,
        blockNumber: data.blockNumber,
        status: 'confirmed',
      },
      update: {},
    });
  }

  async gmtFlowTotals(userId: string): Promise<{ received: number; spent: number }> {
    const rows = await this.prisma.$queryRaw<Array<{ received: string; spent: string }>>`
      SELECT
        COALESCE(SUM(CASE
          WHEN amount > 0
           AND COALESCE(meta->>'movement', 'credit') <> 'release'
           AND COALESCE(meta->>'currency', 'gmt') = 'gmt'
          THEN amount ELSE 0 END), 0)::text AS received,
        COALESCE(SUM(CASE
          WHEN amount < 0
           AND COALESCE(meta->>'movement', 'debit') <> 'lock'
           AND COALESCE(meta->>'currency', 'gmt') = 'gmt'
          THEN -amount ELSE 0 END), 0)::text AS spent
      FROM "MGTTransaction"
      WHERE "userId" = ${userId}
    `;
    return {
      received: Number(rows[0]?.received ?? 0),
      spent: Number(rows[0]?.spent ?? 0),
    };
  }

  async usdtDailyFlow(userId: string, since: Date): Promise<Array<{ day: Date; mined: number; withdrawn: number }>> {
    const rows = await this.prisma.$queryRaw<Array<{ day: Date; mined: string; withdrawn: string }>>`
      SELECT
        date_trunc('day', "createdAt") AS day,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::text AS mined,
        COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::text AS withdrawn
      FROM "MGTTransaction"
      WHERE "userId" = ${userId}
        AND COALESCE(meta->>'currency', '') = 'usdt'
        AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `;
    return rows.map((row) => ({
      day: row.day,
      mined: Number(row.mined),
      withdrawn: Number(row.withdrawn),
    }));
  }

  async getLedgerStartedAt(userId: string): Promise<string | null> {
    const firstMgt = await this.prisma.mGTTransaction.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    return firstMgt?.createdAt?.toISOString() ?? null;
  }

  async listMergedTransactions(userId: string, query: WalletTransactionsQuery) {
    const take = query.limit + 1;

    const gmtOnly = query.flow === 'gmt' || query.flow === 'in' || query.flow === 'out';
    const usdcWhere =
      query.type === 'game' || gmtOnly
        ? null
        : {
            userId,
            ...(query.cursor
              ? {
                  createdAt: {
                    lt: await this.getCursorDate(query.cursor, 'usdc'),
                  },
                }
              : {}),
          };

    const gameCursor = query.cursor
      ? { createdAt: { lt: await this.getCursorDate(query.cursor, 'game') } }
      : {};
    const gmtClauses = gmtOnly
      ? [
          { NOT: { meta: { path: ['currency'], equals: 'usdt' } } },
          { NOT: { meta: { path: ['currency'], equals: 'usdc' } } },
          ...(query.flow === 'in'
            ? [{ amount: { gt: 0 } }, { NOT: { meta: { path: ['movement'], equals: 'release' } } }]
            : []),
          ...(query.flow === 'out'
            ? [{ amount: { lt: 0 } }, { NOT: { meta: { path: ['movement'], equals: 'lock' } } }]
            : []),
        ]
      : [];
    const gameWhere =
      query.type === 'usdc'
        ? null
        : {
            userId,
            ...gameCursor,
            ...(gmtClauses.length ? { AND: gmtClauses } : {}),
          };

    const [usdcRows, gameRows, firstLedger] = await Promise.all([
      usdcWhere
        ? this.prisma.walletTransaction.findMany({
            where: usdcWhere,
            orderBy: { createdAt: 'desc' },
            take,
          })
        : Promise.resolve([]),
      gameWhere
        ? this.prisma.mGTTransaction.findMany({
            where: gameWhere,
            orderBy: { createdAt: 'desc' },
            take,
          })
        : Promise.resolve([]),
      this.getLedgerStartedAt(userId),
    ]);

    const merged = [
      ...usdcRows.map((row) => ({
        id: row.id,
        source: 'usdc' as const,
        type: row.type,
        amount: decimalToNumber(row.amount),
        txHash: row.txHash,
        status: row.status,
        createdAt: row.createdAt,
      })),
      ...gameRows.map((row) => ({
        id: row.id,
        source: 'game' as const,
        type: resolveGameLedgerType(row.type, row.meta),
        amount: decimalToNumber(row.amount),
        balanceAfter: Number(row.balanceAfter),
        txHash: null,
        status: 'confirmed',
        meta: row.meta as Record<string, unknown> | null,
        createdAt: row.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, query.limit);

    const hasMore =
      usdcRows.length > query.limit ||
      gameRows.length > query.limit ||
      merged.length === query.limit;

    return {
      items: merged,
      nextCursor: hasMore && merged.length > 0 ? merged[merged.length - 1]!.id : null,
      ledgerStartedAt: firstLedger,
    };
  }

  private async getCursorDate(cursorId: string, source: 'usdc' | 'game') {
    if (source === 'usdc') {
      const row = await this.prisma.walletTransaction.findUnique({ where: { id: cursorId } });
      return row?.createdAt ?? new Date();
    }
    const row = await this.prisma.mGTTransaction.findUnique({ where: { id: cursorId } });
    return row?.createdAt ?? new Date();
  }
}
