import type { PrismaClient } from '@prisma/client';
import { getPolygonUsdcAddresses } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { config } from '../../config/env.js';

const RPC_FALLBACKS = [
  'https://polygon-rpc.com',
  'https://1rpc.io/matic',
  'https://rpc.ankr.com/polygon',
];

async function rpcCall(method: string, params: unknown[]): Promise<unknown | null> {
  const urls = [config.POLYGON_RPC_URL, ...RPC_FALLBACKS].filter(Boolean) as string[];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
        signal: AbortSignal.timeout(8000),
      });
      const json = (await res.json()) as { result?: unknown; error?: unknown };
      if (json.result !== undefined && json.error === undefined) return json.result;
    } catch {
      // try next RPC
    }
  }
  return null;
}

async function fetchVaultUsdcBalance(): Promise<number | null> {
  const vault = config.CONTRACT_USDC_VAULT?.toLowerCase();
  if (!vault) return null;

  const padded = vault.slice(2).padStart(64, '0');
  const callData = `0x70a08231${padded}`;
  const tokens = getPolygonUsdcAddresses(config.USDC_ADDRESS);

  let total = 0;
  let anySuccess = false;

  for (const token of tokens) {
    const result = await rpcCall('eth_call', [{ to: token, data: callData }, 'latest']);
    if (typeof result !== 'string' || !result || result === '0x') continue;
    total += parseInt(result, 16) / 1e6;
    anySuccess = true;
  }

  return anySuccess ? total : null;
}

async function fetchTxBlockNumber(txHash: string): Promise<number | null> {
  const result = await rpcCall('eth_getTransactionReceipt', [txHash]);
  if (!result || typeof result !== 'object') return null;
  const blockHex = (result as { blockNumber?: string }).blockNumber;
  if (!blockHex) return null;
  return Number(BigInt(blockHex));
}

interface TransparencySectionDTO {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  order: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapSection(row: {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  order: number;
  visible: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TransparencySectionDTO {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    imageUrl: row.imageUrl,
    order: row.order,
    visible: row.visible,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class TransparencyService {
  constructor(private readonly prisma: PrismaClient) {}

  async listAll() {
    const rows = await this.prisma.transparencySection.findMany({
      orderBy: { order: 'asc' },
    });
    return rows.map(mapSection);
  }

  async listVisible() {
    const rows = await this.prisma.transparencySection.findMany({
      where: { visible: true },
      orderBy: { order: 'asc' },
    });
    return rows.map(mapSection);
  }

  async create(data: {
    title: string;
    body: string;
    imageUrl?: string | null;
    order?: number;
    visible?: boolean;
  }) {
    const row = await this.prisma.transparencySection.create({
      data: {
        title: data.title,
        body: data.body,
        imageUrl: data.imageUrl ?? null,
        order: data.order ?? 0,
        visible: data.visible ?? true,
      },
    });
    return mapSection(row);
  }

  async update(id: string, data: Partial<{
    title: string;
    body: string;
    imageUrl: string | null;
    order: number;
    visible: boolean;
  }>) {
    const existing = await this.prisma.transparencySection.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCode.ANNOUNCEMENT_NOT_FOUND, 404);

    const row = await this.prisma.transparencySection.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.order !== undefined ? { order: data.order } : {}),
        ...(data.visible !== undefined ? { visible: data.visible } : {}),
      },
    });
    return mapSection(row);
  }

  async remove(id: string) {
    await this.prisma.transparencySection.delete({ where: { id } });
    return { ok: true };
  }

  private async enrichMissingBlockNumbers(
    rows: Array<{ id: string; txHash: string; blockNumber: bigint | null }>,
  ): Promise<Map<string, number>> {
    const resolved = new Map<string, number>();
    const missing = rows.filter((r) => !r.blockNumber);

    await Promise.all(
      missing.map(async (row) => {
        const block = await fetchTxBlockNumber(row.txHash);
        if (block == null) return;
        resolved.set(row.txHash, block);
        void this.prisma.walletTransaction
          .update({ where: { id: row.id }, data: { blockNumber: BigInt(block) } })
          .catch(() => undefined);
      }),
    );

    return resolved;
  }

  async publicDeposits(page = 1) {
    const PAGE_SIZE = 20;
    const skip = (page - 1) * PAGE_SIZE;

    const [rows, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { type: 'usdc_deposit', status: 'confirmed' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
        select: { id: true, amount: true, txHash: true, blockNumber: true, createdAt: true },
      }),
      this.prisma.walletTransaction.count({ where: { type: 'usdc_deposit', status: 'confirmed' } }),
    ]);

    const blockOverrides = await this.enrichMissingBlockNumbers(rows);

    return {
      deposits: rows.map((r) => ({
        amountUsdc: Number(r.amount),
        txHash: r.txHash,
        blockNumber: r.blockNumber
          ? Number(r.blockNumber)
          : (blockOverrides.get(r.txHash) ?? null),
        confirmedAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pages: Math.ceil(total / PAGE_SIZE),
    };
  }

  async publicStats() {
    const [deposits, withdrawals, referralCommissions, platformCfg, vaultUsdcBalance] =
      await Promise.all([
        this.prisma.walletTransaction.aggregate({
          where: { type: 'usdc_deposit', status: 'confirmed' },
          _count: true,
          _sum: { amount: true },
        }),
        this.prisma.withdrawalRequest.aggregate({
          where: { status: 'completed' },
          _count: true,
          _sum: { amountUsdc: true },
        }),
        this.prisma.mGTTransaction.aggregate({
          where: { type: 'referral' },
          _count: true,
          _sum: { amount: true },
        }),
        this.prisma.platformConfig.findUnique({ where: { id: 'default' } }),
        fetchVaultUsdcBalance(),
      ]);

    const totalDepositedUsdc = Number(deposits._sum.amount ?? 0);
    const totalWithdrawnUsdc = Number(withdrawals._sum.amountUsdc ?? 0);
    const totalReferralCommissionsGmt = Number(referralCommissions._sum.amount ?? 0);

    return {
      flow: {
        depositCount: deposits._count,
        totalDepositedUsdc,
        withdrawalCount: withdrawals._count,
        totalWithdrawnUsdc,
        referralCommissionCount: referralCommissions._count,
        totalReferralCommissionsGmt,
        /** @deprecated use totalReferralCommissionsGmt — kept for older clients */
        totalReferralCommissionsUsdc: totalReferralCommissionsGmt,
      },
      vault: {
        address: config.CONTRACT_USDC_VAULT ?? null,
        usdcBalance: vaultUsdcBalance,
        chainId: config.CHAIN_ID,
        usdcToken: config.USDC_ADDRESS,
      },
      allocation: (platformCfg?.allocationJson ?? []) as Array<{ label: string; pct: number; color?: string }>,
      generatedAt: new Date().toISOString(),
    };
  }
}
