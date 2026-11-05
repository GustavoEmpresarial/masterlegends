/** keccak256("Deposited(address,uint256)") */
export const VAULT_DEPOSITED_TOPIC =
  '0x2da466a7b24304f47e87fa2e1e5a81b9831ce54fec19055ce277ca2f39ba42c4';

/** keccak256("Withdrawn(address,uint256)") */
export const VAULT_WITHDRAWN_TOPIC =
  '0x7084f5476618d8e60b11ef0d7d3f06914655adb8793e28ff7f018d4c76d505d5';

export interface PolygonscanLogDTO {
  address: string;
  topics: string[];
  data: string;
  transactionHash: string;
  blockNumber: string;
  logIndex: string;
}

export function parseDepositedLog(log: PolygonscanLogDTO): {
  wallet: string;
  amount: bigint;
  txHash: string;
  blockNumber: bigint;
} | null {
  if (log.topics.length < 2) return null;
  const wallet = ('0x' + log.topics[1]!.slice(-40)).toLowerCase();
  const amount = BigInt(log.data);
  const txHash = log.transactionHash.toLowerCase();
  const blockNumber = BigInt(log.blockNumber);
  return { wallet, amount, txHash, blockNumber };
}

export function parseDepositedTopicLog(topics: string[], data: string): {
  wallet: string;
  amount: bigint;
} | null {
  if (topics.length < 2 || topics[0]?.toLowerCase() !== VAULT_DEPOSITED_TOPIC) return null;
  return {
    wallet: ('0x' + topics[1]!.slice(-40)).toLowerCase(),
    amount: BigInt(data),
  };
}
