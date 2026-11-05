import type { PolygonscanLogDTO } from './vault.js';

/** keccak256("Transfer(address,address,uint256)") */
export const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** Polygon mainnet (chain 137) */
export const POLYGON_CHAIN_ID = 137;

/** USDC nativo Circle na Polygon */
export const POLYGON_USDC_NATIVE = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359';

/** USDC bridged (USDC.e) — ainda comum em wallets Polygon */
export const POLYGON_USDC_BRIDGED = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

/** Endereços USDC aceites na Polygon (nativo + bridged). */
export function getPolygonUsdcAddresses(primaryUsdc?: string): string[] {
  const native = (primaryUsdc?.trim() || POLYGON_USDC_NATIVE).toLowerCase();
  const bridged = POLYGON_USDC_BRIDGED.toLowerCase();
  if (native === bridged) return [native];
  return [native, bridged];
}

export function isPolygonUsdcAddress(address: string, primaryUsdc?: string): boolean {
  return getPolygonUsdcAddresses(primaryUsdc).includes(address.toLowerCase());
}

export function encodeLogTopicAddress(address: string): string {
  return `0x${address.slice(2).toLowerCase().padStart(64, '0')}`;
}

export function topicToAddress(topic: string): string {
  return (`0x${topic.slice(-40)}`).toLowerCase();
}

/** Parses USDC Transfer log when `to` matches the treasury deposit wallet. */
export function parseTreasuryTransferLog(
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

export function parseTreasuryTransferTopicLog(
  topics: string[],
  data: string,
  treasuryAddress: string,
): { wallet: string; amount: bigint } | null {
  if (topics.length < 3 || topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) return null;

  const to = topicToAddress(topics[2]!);
  if (to !== treasuryAddress.toLowerCase()) return null;

  const wallet = topicToAddress(topics[1]!);
  const amount = BigInt(data);
  if (amount <= 0n) return null;

  return { wallet, amount };
}
