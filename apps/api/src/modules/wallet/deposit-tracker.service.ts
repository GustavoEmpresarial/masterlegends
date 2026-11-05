import type Redis from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ethers } from 'ethers';
import {
  ChainEvent,
  ERC20_TRANSFER_TOPIC,
  MgtTxType,
  PolygonscanClient,
  WalletTxType,
  getPolygonUsdcAddresses,
  isPolygonUsdcAddress,
  parseTreasuryTransferTopicLog,
  type TrackDepositResponseDTO,
} from '@mll/shared';
import { config } from '../../config/env.js';
import { JobQueues } from '../../common/lib/queues.js';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { WalletRepository } from './wallet.repository.js';
import { PlatformConfigService } from '../platform/platform-config.service.js';
import { applyUsdcCredit } from './mgt-ledger.js';

type TxReceipt = {
  status?: string;
  blockNumber?: string;
  logs?: Array<{ address: string; topics: string[]; data: string }>;
};

const DEPOSIT_TX_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CLAIM_ATTEMPTS = 72;

export class DepositTrackerService {
  private readonly queues: JobQueues;
  private readonly platform: PlatformConfigService;

  constructor(
    private readonly repo: WalletRepository,
    private readonly prisma: PrismaClient,
    redis: Redis,
  ) {
    this.queues = new JobQueues(redis);
    this.platform = new PlatformConfigService(prisma);
  }

  private isUsablePolygonscanKey(key: string | undefined): boolean {
    if (!key?.trim()) return false;
    if (/your-polygonscan|placeholder|changeme/i.test(key)) return false;
    return true;
  }

  private async getReceiptViaRpc(txHash: string): Promise<TxReceipt | null> {
    const rpcUrl = config.CHAIN_ID === 137 ? config.POLYGON_RPC_URL : config.AMOY_RPC_URL;
    if (!rpcUrl) return null;

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return null;

    return {
      status: receipt.status === 1 ? '0x1' : '0x0',
      blockNumber: `0x${receipt.blockNumber.toString(16)}`,
      logs: receipt.logs.map((log) => ({
        address: log.address,
        topics: log.topics as string[],
        data: log.data,
      })),
    };
  }

  private async getTransactionReceipt(txHash: string): Promise<TxReceipt | null> {
    const apiKey = config.POLYGONSCAN_API_KEY;
    if (this.isUsablePolygonscanKey(apiKey)) {
      try {
        const client = new PolygonscanClient(apiKey!, config.CHAIN_ID);
        const receipt = await client.getTransactionReceipt(txHash);
        if (receipt) return receipt;
      } catch {
        /* fall back to RPC */
      }
    }

    return this.getReceiptViaRpc(txHash);
  }

  private async getBlockTimestamp(blockNumberHex: string): Promise<number | null> {
    const rpcUrl = config.CHAIN_ID === 137 ? config.POLYGON_RPC_URL : config.AMOY_RPC_URL;
    if (!rpcUrl) return null;
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const block = await provider.getBlock(Number(BigInt(blockNumberHex)));
      return block?.timestamp ?? null;
    } catch {
      return null;
    }
  }

  private findUserTransferLog(
    receipt: TxReceipt,
    treasuryAddress: string,
    userWallet: string,
  ): { wallet: string; amount: bigint } | null {
    const treasury = treasuryAddress.toLowerCase();
    const wallet = userWallet.toLowerCase();

    for (const log of receipt.logs ?? []) {
      if (!isPolygonUsdcAddress(log.address, config.USDC_ADDRESS)) continue;
      if (log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) continue;

      const parsed = parseTreasuryTransferTopicLog(log.topics, log.data, treasury);
      if (parsed && parsed.wallet === wallet) {
        return parsed;
      }
    }
    return null;
  }

  /** Any USDC transfer to treasury in the receipt (manual deposit fallback). */
  private findTreasuryIncomingTransfer(
    receipt: TxReceipt,
    treasuryAddress: string,
  ): { wallet: string; amount: bigint } | null {
    const treasury = treasuryAddress.toLowerCase();

    for (const log of receipt.logs ?? []) {
      if (!isPolygonUsdcAddress(log.address, config.USDC_ADDRESS)) continue;
      if (log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) continue;

      const parsed = parseTreasuryTransferTopicLog(log.topics, log.data, treasury);
      if (parsed) return parsed;
    }
    return null;
  }

  private async creditDepositToUser(
    userId: string,
    amountUsdc: number,
    normalizedHash: string,
    blockNumber?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.walletTransaction.findUnique({ where: { txHash: normalizedHash } });
      if (existing) return;

      await tx.mGTBalance.upsert({
        where: { userId },
        create: { userId, amount: 0, usdcAmount: 0 },
        update: {},
      });

      await tx.walletTransaction.create({
        data: {
          userId,
          type: WalletTxType.USDC_DEPOSIT,
          amount: new Prisma.Decimal(amountUsdc),
          txHash: normalizedHash,
          blockNumber: blockNumber != null ? BigInt(blockNumber) : undefined,
          status: 'confirmed',
        },
      });

      await applyUsdcCredit(tx, userId, amountUsdc, MgtTxType.USDC_DEPOSIT, { txHash: normalizedHash });
    });
  }

  private async rejectClaim(
    claimId: string,
    userId: string,
    txHash: string,
    reason: string,
    meta?: Record<string, unknown>,
  ): Promise<TrackDepositResponseDTO> {
    await this.prisma.depositClaim.update({
      where: { id: claimId },
      data: { status: 'rejected', failReason: reason, lastCheckedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'deposit_claim_rejected',
        severity: 'warn',
        meta: { txHash, reason, ...meta },
      },
    });
    return { status: 'rejected', txHash, reason };
  }

  async listClaims(userId: string) {
    const rows = await this.prisma.depositClaim.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      claims: rows.map((r) => ({
        id: r.id,
        txHash: r.txHash,
        status: r.status,
        failReason: r.failReason,
        attemptCount: r.attemptCount,
        lastCheckedAt: r.lastCheckedAt?.toISOString() ?? null,
        creditedAt: r.creditedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async trackDeposit(
    userId: string,
    txHash: string,
    ctx?: { ip?: string; userAgent?: string },
  ): Promise<TrackDepositResponseDTO> {
    const normalizedHash = txHash.toLowerCase();

    const user = await this.repo.findUserWallet(userId);
    const linkedWallet = user?.wallet?.toLowerCase() ?? null;

    const existing = await this.repo.findWalletTransactionByHash(normalizedHash);
    if (existing) {
      return {
        status: 'already_credited',
        txHash: normalizedHash,
        amountUsdc: Math.abs(Number(existing.amount)),
      };
    }

    const priorClaim = await this.prisma.depositClaim.findUnique({ where: { txHash: normalizedHash } });
    if (priorClaim) {
      if (priorClaim.status === 'rejected') {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 403, {
          reason: priorClaim.failReason ?? 'deposit_claim_rejected',
        });
      }
      if (priorClaim.userId !== userId) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 403, { reason: 'deposit_hash_taken' });
      }
      if (priorClaim.status === 'queued' || priorClaim.status === 'credited') {
        return { status: priorClaim.status === 'credited' ? 'already_credited' : 'queued', txHash: normalizedHash };
      }
    }

    const recentClaims = await this.prisma.depositClaim.count({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (recentClaims >= 5 && !priorClaim) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 429, { reason: 'deposit_claim_rate_limit' });
    }

    const claim = priorClaim ?? (await this.prisma.depositClaim.create({
      data: { userId, txHash: normalizedHash, status: 'pending' },
    }));

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'deposit_claim_submitted',
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
        meta: { txHash: normalizedHash },
      },
    });

    return this.verifyClaim(claim.id, userId, linkedWallet, normalizedHash);
  }

  /** Called by API track endpoint and worker recheck job. */
  async verifyClaim(
    claimId: string,
    userId: string,
    userWallet: string | null,
    normalizedHash: string,
  ): Promise<TrackDepositResponseDTO> {
    const treasuryAddress = config.CONTRACT_USDC_VAULT?.toLowerCase();
    const usdcAddresses = getPolygonUsdcAddresses(config.USDC_ADDRESS);
    if (!treasuryAddress || usdcAddresses.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 503, { reason: 'deposit_wallet_not_configured' });
    }

    const claim = await this.prisma.depositClaim.findUnique({ where: { id: claimId } });
    if (!claim || claim.status === 'rejected' || claim.status === 'credited') {
      if (claim?.status === 'credited') {
        return { status: 'already_credited', txHash: normalizedHash };
      }
      throw new AppError(ErrorCode.VALIDATION_ERROR, 403, { reason: claim?.failReason ?? 'deposit_claim_rejected' });
    }

    const attemptCount = claim.attemptCount + 1;
    await this.prisma.depositClaim.update({
      where: { id: claimId },
      data: { attemptCount, lastCheckedAt: new Date() },
    });

    if (attemptCount > MAX_CLAIM_ATTEMPTS) {
      await this.prisma.depositClaim.update({
        where: { id: claimId },
        data: { status: 'failed', failReason: 'verification_timeout' },
      });
      return { status: 'rejected', txHash: normalizedHash, reason: 'verification_timeout' };
    }

    const receipt = await this.getTransactionReceipt(normalizedHash);
    if (!receipt || receipt.status !== '0x1') {
      return { status: 'pending', txHash: normalizedHash, reason: 'tx_not_confirmed' };
    }

    if (receipt.blockNumber) {
      const ts = await this.getBlockTimestamp(receipt.blockNumber);
      if (ts && Date.now() - ts * 1000 > DEPOSIT_TX_MAX_AGE_MS) {
        return this.rejectClaim(claimId, userId, normalizedHash, 'deposit_tx_too_old');
      }
    }

    const parsed = userWallet
      ? this.findUserTransferLog(receipt, treasuryAddress, userWallet)
      : this.findTreasuryIncomingTransfer(receipt, treasuryAddress);

    if (!parsed) {
      return this.rejectClaim(
        claimId,
        userId,
        normalizedHash,
        userWallet ? 'deposit_wallet_mismatch' : 'deposit_not_to_treasury',
      );
    }

    const platformCfg = await this.platform.get();
    const amountUsdc = Number(parsed.amount) / 1_000_000;
    if (amountUsdc < platformCfg.minDepositUsdc) {
      return this.rejectClaim(claimId, userId, normalizedHash, 'deposit_below_minimum', {
        amountUsdc,
        minDepositUsdc: platformCfg.minDepositUsdc,
      });
    }

    const existing = await this.repo.findWalletTransactionByHash(normalizedHash);
    if (existing) {
      await this.prisma.depositClaim.update({
        where: { id: claimId },
        data: { status: 'credited', creditedAt: new Date() },
      });
      return {
        status: 'already_credited',
        txHash: normalizedHash,
        amountUsdc: Math.abs(Number(existing.amount)),
      };
    }

    if (!userWallet) {
      await this.creditDepositToUser(userId, amountUsdc, normalizedHash, receipt.blockNumber);
      await this.prisma.depositClaim.update({
        where: { id: claimId },
        data: { status: 'credited', creditedAt: new Date() },
      });
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'deposit_claim_credited_manual',
          meta: { txHash: normalizedHash, amountUsdc, senderWallet: parsed.wallet },
        },
      });
      return { status: 'credited', txHash: normalizedHash, amountUsdc };
    }

    await this.queues.enqueueChainEvent(ChainEvent.UsdcDeposited, {
      user: parsed.wallet,
      amount: parsed.amount.toString(),
      txHash: normalizedHash,
      blockNumber: receipt.blockNumber ? Number(BigInt(receipt.blockNumber)) : undefined,
    });

    await this.prisma.depositClaim.update({
      where: { id: claimId },
      data: { status: 'queued' },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'deposit_claim_queued',
        meta: { txHash: normalizedHash, amountUsdc },
      },
    });

    return { status: 'queued', txHash: normalizedHash, amountUsdc };
  }

  /** Worker: recheck all pending claims due for verification. */
  async recheckPendingClaims(): Promise<{ checked: number; queued: number; rejected: number }> {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const pending = await this.prisma.depositClaim.findMany({
      where: {
        status: 'pending',
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lte: cutoff } }],
      },
      take: 100,
      include: { user: { select: { wallet: true } } },
    });

    let queued = 0;
    let rejected = 0;

    for (const claim of pending) {
      const result = await this.verifyClaim(
        claim.id,
        claim.userId,
        claim.user.wallet?.toLowerCase() ?? null,
        claim.txHash,
      );
      if (result.status === 'queued') queued += 1;
      if (result.status === 'rejected') rejected += 1;
    }

    return { checked: pending.length, queued, rejected };
  }
}
