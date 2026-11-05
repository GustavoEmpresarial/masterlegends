import type { MgtTxTypeName, WalletTxTypeName } from '../../economy/mgt.js';

export interface WalletSummaryDTO {
  wallet: string | null;
  /** GMT — in-game token (mint, merge, shop, farm claim). */
  gmtBalance: number;
  /** GMT comprometido em operação ainda aberta. */
  gmtLocked: number;
  /** USDT comprometido em saque pendente. */
  usdtLocked: number;
  /** Soma dos créditos GMT, sem contar devolução de bloqueio. */
  gmtReceived: number;
  /** Soma dos débitos GMT, sem contar o bloqueio em si. */
  gmtSpent: number;
  /** USDC — vault balance (depósitos / swap → GMT). */
  usdcBalance: number;
  /** USDT — ganhos de mineração / saldo sacável (a partir de 01/08/2026). */
  usdtBalance: number;
  pendingFarmUsdc: number;
  usdcPerHour: number;
  usdcVaultBalance: number;
  swapRate: number;
  chainId: number;
  usdcVaultAddress: string | null;
  usdcAddress: string;
  usdtAddress: string;
  ledgerStartedAt: string | null;
  minDepositUsdc: number;
  minWithdrawUsdc: number;
  withdrawFeePct: number;
  withdrawalsPaused: boolean;
}

export interface WalletTransactionItemDTO {
  id: string;
  source: 'usdc' | 'game';
  type: WalletTxTypeName | MgtTxTypeName;
  amount: number;
  balanceAfter?: number;
  txHash?: string | null;
  status: string;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}

export interface WalletTransactionsDTO {
  items: WalletTransactionItemDTO[];
  nextCursor: string | null;
  ledgerStartedAt: string | null;
}

export interface MiningAnalyticsPointDTO {
  date: string;
  mined: number;
  withdrawn: number;
  balance: number;
}

export interface MiningAnalyticsDTO {
  usdtBalance: number;
  points: MiningAnalyticsPointDTO[];
}
