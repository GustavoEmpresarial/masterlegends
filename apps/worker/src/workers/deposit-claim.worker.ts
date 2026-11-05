import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import {
  ChainEvent,
  ERC20_TRANSFER_TOPIC,
  MgtTxType,
  PolygonscanClient,
  WalletTxType,
  getPolygonUsdcAddresses,
  isPolygonUsdcAddress,
  parseTreasuryTransferTopicLog,
} from '@mll/shared';
import { Prisma } from '@prisma/client';
import { config } from '../config/env.js';
import { processUsdcVaultEvent } from '../lib/vault-events.js';
import { applyUsdcCredit } from '../lib/mgt-ledger.js';

const DEPOSIT_TX_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CLAIM_ATTEMPTS = 72;

type TxReceipt = {
  status?: string;
  blockNumber?: string;
  logs?: Array<{ address: string; topics: string[]; data: string }>;
};

function isUsablePolygonscanKey(key: string | undefined): boolean {
  if (!key?.trim()) return false;
  if (/your-polygonscan|placeholder|changeme/i.test(key)) return false;
  return true;
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T | null> {
  const rpcUrl = config.CHAIN_ID === 137 ? config.POLYGON_RPC_URL : config.AMOY_RPC_URL;
  if (!rpcUrl) return null;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: T; error?: unknown };
  if (json.error) return null;
  return json.result ?? null;
}

async function getTransactionReceipt(txHash: string): Promise<TxReceipt | null> {
  const apiKey = config.POLYGONSCAN_API_KEY;
  if (isUsablePolygonscanKey(apiKey)) {
    try {
      const client = new PolygonscanClient(apiKey!, config.CHAIN_ID);
      const receipt = await client.getTransactionReceipt(txHash);
      if (receipt) return receipt;
    } catch {
      /* fallback rpc */
    }
  }
  return rpcCall<TxReceipt>('eth_getTransactionReceipt', [txHash]);
}

async function getBlockTimestamp(blockNumberHex: string): Promise<number | null> {
  const block = await rpcCall<{ timestamp?: string }>('eth_getBlockByNumber', [blockNumberHex, false]);
  if (!block?.timestamp) return null;
  return Number(BigInt(block.timestamp));
}

function findUserTransferLog(
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
    if (parsed && parsed.wallet === wallet) return parsed;
  }
  return null;
}

function findTreasuryIncomingTransfer(
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

export async function recheckPendingDepositClaims(
  prisma: PrismaClient,
  logger: Logger,
): Promise<{ checked: number; queued: number; rejected: number }> {
  const treasuryAddress = config.CONTRACT_USDC_VAULT?.toLowerCase();
  if (!treasuryAddress || getPolygonUsdcAddresses(config.USDC_ADDRESS).length === 0) {
    return { checked: 0, queued: 0, rejected: 0 };
  }

  const platformRow = await prisma.platformConfig.findFirst();
  const minDepositUsdc = Number(platformRow?.minDepositUsdc ?? 1);

  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const pending = await prisma.depositClaim.findMany({
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
    const linkedWallet = claim.user.wallet?.toLowerCase() ?? null;

    const attemptCount = claim.attemptCount + 1;
    await prisma.depositClaim.update({
      where: { id: claim.id },
      data: { attemptCount, lastCheckedAt: new Date() },
    });

    if (attemptCount > MAX_CLAIM_ATTEMPTS) {
      await prisma.depositClaim.update({
        where: { id: claim.id },
        data: { status: 'failed', failReason: 'verification_timeout' },
      });
      rejected += 1;
      continue;
    }

    const receipt = await getTransactionReceipt(claim.txHash);
    if (!receipt || receipt.status !== '0x1') continue;

    if (receipt.blockNumber) {
      const ts = await getBlockTimestamp(receipt.blockNumber);
      if (ts && Date.now() - ts * 1000 > DEPOSIT_TX_MAX_AGE_MS) {
        await prisma.depositClaim.update({
          where: { id: claim.id },
          data: { status: 'rejected', failReason: 'deposit_tx_too_old' },
        });
        rejected += 1;
        continue;
      }
    }

    const parsed = linkedWallet
      ? findUserTransferLog(receipt, treasuryAddress, linkedWallet)
      : findTreasuryIncomingTransfer(receipt, treasuryAddress);

    if (!parsed) {
      await prisma.depositClaim.update({
        where: { id: claim.id },
        data: {
          status: 'rejected',
          failReason: linkedWallet ? 'deposit_wallet_mismatch' : 'deposit_not_to_treasury',
        },
      });
      rejected += 1;
      continue;
    }

    const amountUsdc = Number(parsed.amount) / 1_000_000;
    if (amountUsdc < minDepositUsdc) {
      await prisma.depositClaim.update({
        where: { id: claim.id },
        data: { status: 'rejected', failReason: 'deposit_below_minimum' },
      });
      rejected += 1;
      continue;
    }

    const priorTx = await prisma.walletTransaction.findUnique({ where: { txHash: claim.txHash } });
    if (priorTx) {
      await prisma.depositClaim.update({
        where: { id: claim.id },
        data: { status: 'credited', creditedAt: new Date() },
      });
      queued += 1;
      continue;
    }

    if (!linkedWallet) {
      await prisma.$transaction(async (tx) => {
        await tx.mGTBalance.upsert({
          where: { userId: claim.userId },
          create: { userId: claim.userId, amount: 0, usdcAmount: 0 },
          update: {},
        });
        await tx.walletTransaction.create({
          data: {
            userId: claim.userId,
            type: WalletTxType.USDC_DEPOSIT,
            amount: new Prisma.Decimal(amountUsdc),
            txHash: claim.txHash,
            blockNumber: receipt.blockNumber ? BigInt(receipt.blockNumber) : undefined,
            status: 'confirmed',
          },
        });
        await applyUsdcCredit(tx, claim.userId, amountUsdc, MgtTxType.USDC_DEPOSIT, { txHash: claim.txHash });
      });
      await prisma.depositClaim.update({
        where: { id: claim.id },
        data: { status: 'credited', creditedAt: new Date() },
      });
      queued += 1;
      continue;
    }

    const result = await processUsdcVaultEvent(
      prisma,
      ChainEvent.UsdcDeposited,
      {
        user: parsed.wallet,
        amount: parsed.amount.toString(),
        txHash: claim.txHash,
        blockNumber: receipt.blockNumber,
      },
      logger,
    );

    if (result === 'credited' || result === 'already_credited') {
      await prisma.depositClaim.update({
        where: { id: claim.id },
        data: {
          status: result === 'credited' ? 'credited' : 'queued',
          creditedAt: new Date(),
        },
      });
      queued += 1;
    }
  }

  if (pending.length > 0) {
    logger.info(
      { event: 'deposit_claim.recheck', checked: pending.length, queued, rejected },
      'Deposit claim recheck finished',
    );
  }

  return { checked: pending.length, queued, rejected };
}
