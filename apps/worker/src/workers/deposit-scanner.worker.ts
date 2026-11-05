import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import {
  ChainEvent,
  ERC20_TRANSFER_TOPIC,
  PolygonscanClient,
  encodeLogTopicAddress,
  getPolygonUsdcAddresses,
  parseTreasuryTransferLog,
  parseTreasuryTransferTopicLog,
} from '@mll/shared';
import { config } from '../config/env.js';
import { processUsdcVaultEvent } from '../lib/vault-events.js';

const SCANNER_LAST_BLOCK_KEY = 'chain:treasury-deposit-scanner:last-block';
const BLOCK_CHUNK = 2_000;
const LOOKBACK_BLOCKS = 50_000;

type RpcLog = {
  topics: string[];
  data: string;
  transactionHash: string;
  blockNumber: string;
};

function isUsablePolygonscanKey(key: string | undefined): boolean {
  if (!key?.trim()) return false;
  if (/your-polygonscan|placeholder|changeme/i.test(key)) return false;
  return true;
}

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: T; error?: { message?: string } };
  if (json.error) {
    throw new Error(json.error.message ?? 'rpc_error');
  }
  return json.result as T;
}

async function scanVaultDepositsViaRpc(
  prisma: PrismaClient,
  redis: Redis,
  logger: Logger,
  treasuryAddress: string,
  usdcAddress: string,
): Promise<{ scanned: number; credited: number }> {
  const rpcUrl = config.CHAIN_ID === 137 ? config.POLYGON_RPC_URL : config.AMOY_RPC_URL;
  if (!rpcUrl) {
    return { scanned: 0, credited: 0 };
  }

  const latestHex = await rpcCall<string>(rpcUrl, 'eth_blockNumber', []);
  const latest = Number(BigInt(latestHex));
  const treasury = treasuryAddress.toLowerCase();
  const usdcContracts = getPolygonUsdcAddresses(usdcAddress);
  const treasuryTopic = encodeLogTopicAddress(treasury);

  const stored = await redis.get(SCANNER_LAST_BLOCK_KEY);
  let fromBlock = stored ? Number(stored) + 1 : Math.max(0, latest - LOOKBACK_BLOCKS);

  if (fromBlock > latest) {
    return { scanned: 0, credited: 0 };
  }

  let scanned = 0;
  let credited = 0;

  while (fromBlock <= latest) {
    const toBlock = Math.min(fromBlock + BLOCK_CHUNK - 1, latest);
    const logs = await rpcCall<RpcLog[]>(rpcUrl, 'eth_getLogs', [
      {
        address: usdcContracts,
        topics: [ERC20_TRANSFER_TOPIC, null, treasuryTopic],
        fromBlock: `0x${fromBlock.toString(16)}`,
        toBlock: `0x${toBlock.toString(16)}`,
      },
    ]);

    for (const log of logs) {
      const parsed = parseTreasuryTransferTopicLog(log.topics, log.data, treasury);
      if (!parsed) continue;
      scanned += 1;

      const result = await processUsdcVaultEvent(
        prisma,
        ChainEvent.UsdcDeposited,
        {
          user: parsed.wallet,
          amount: parsed.amount.toString(),
          txHash: log.transactionHash,
          blockNumber: String(Number(BigInt(log.blockNumber))),
        },
        logger,
      );

      if (result === 'credited') credited += 1;
    }

    await redis.set(SCANNER_LAST_BLOCK_KEY, String(toBlock));
    fromBlock = toBlock + 1;
  }

  return { scanned, credited };
}

export async function scanVaultDeposits(
  prisma: PrismaClient,
  redis: Redis,
  logger: Logger,
): Promise<{ scanned: number; credited: number }> {
  const apiKey = config.POLYGONSCAN_API_KEY;
  const treasuryAddress = config.CONTRACT_USDC_VAULT;
  const usdcAddress = config.USDC_ADDRESS;
  if (!treasuryAddress || !usdcAddress) {
    logger.debug('Treasury deposit scanner skipped: missing treasury or USDC address');
    return { scanned: 0, credited: 0 };
  }

  if (!isUsablePolygonscanKey(apiKey)) {
    const result = await scanVaultDepositsViaRpc(prisma, redis, logger, treasuryAddress, usdcAddress);
    return result;
  }

  const client = new PolygonscanClient(apiKey!, config.CHAIN_ID);
  const latest = await client.getLatestBlockNumber();
  const treasuryTopic = encodeLogTopicAddress(treasuryAddress);
  const usdcContracts = getPolygonUsdcAddresses(usdcAddress);

  const stored = await redis.get(SCANNER_LAST_BLOCK_KEY);
  let fromBlock = stored
    ? Number(stored) + 1
    : Math.max(0, latest - LOOKBACK_BLOCKS);

  if (fromBlock > latest) {
    return { scanned: 0, credited: 0 };
  }

  let scanned = 0;
  let credited = 0;

  while (fromBlock <= latest) {
    const toBlock = Math.min(fromBlock + BLOCK_CHUNK - 1, latest);

    for (const contract of usdcContracts) {
      const logs = await client.getVaultLogs({
        vaultAddress: contract,
        topic0: ERC20_TRANSFER_TOPIC,
        topic2: treasuryTopic,
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        const parsed = parseTreasuryTransferLog(log, treasuryAddress);
        if (!parsed) continue;
        scanned += 1;

        const result = await processUsdcVaultEvent(
          prisma,
          ChainEvent.UsdcDeposited,
          {
            user: parsed.wallet,
            amount: parsed.amount.toString(),
            txHash: parsed.txHash,
            blockNumber: parsed.blockNumber.toString(),
          },
          logger,
        );

        if (result === 'credited') credited += 1;
      }
    }

    await redis.set(SCANNER_LAST_BLOCK_KEY, String(toBlock));
    fromBlock = toBlock + 1;
  }

  if (scanned > 0 || credited > 0) {
    logger.info(
      { event: 'treasury.deposit_scan', scanned, credited, latestBlock: latest },
      'Treasury USDC deposit scan finished',
    );
  }

  return { scanned, credited };
}
