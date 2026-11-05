/**
 * USDT (Polygon) — moeda de pagamento de mineração e saques a partir de 01/08/2026.
 * Payout continua manual/MetaMask pelo admin; estes helpers servem para
 * verificação/decodificação de logs de Transfer, espelhando `usdc-transfer.ts`.
 */
import { ERC20_TRANSFER_TOPIC, topicToAddress } from './usdc-transfer.js';
import type { PolygonscanLogDTO } from './vault.js';

/** USDT (Tether) na Polygon — 6 decimais, igual USDC. */
export const POLYGON_USDT = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';

/** USDT usa 6 decimais na Polygon. */
export const USDT_DECIMALS = 6;

/** Endereços USDT aceites na Polygon. */
export function getPolygonUsdtAddresses(primaryUsdt?: string): string[] {
  return [(primaryUsdt?.trim() || POLYGON_USDT).toLowerCase()];
}

export function isPolygonUsdtAddress(address: string, primaryUsdt?: string): boolean {
  return getPolygonUsdtAddresses(primaryUsdt).includes(address.toLowerCase());
}

/** Parses USDT Transfer log when `to` matches the treasury/payout wallet. */
export function parseUsdtTransferLog(
  log: PolygonscanLogDTO,
  treasuryAddress: string,
): {
  wallet: string;
  amount: bigint;
  txHash: string;
  blockNumber: bigint;
} | null {
  if (log.topics.length < 3) return null;
  if (log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) return null;

  const to = topicToAddress(log.topics[2]!);
  if (to !== treasuryAddress.toLowerCase()) return null;

  const wallet = topicToAddress(log.topics[1]!);
  const amount = BigInt(log.data);
  if (amount <= 0n) return null;

  return {
    wallet,
    amount,
    txHash: log.transactionHash.toLowerCase(),
    blockNumber: BigInt(log.blockNumber),
  };
}
