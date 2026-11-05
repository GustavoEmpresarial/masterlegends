import { z } from 'zod';

export const trackDepositSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
});

export type TrackDepositInput = z.infer<typeof trackDepositSchema>;

export interface TrackDepositResponseDTO {
  status: 'credited' | 'already_credited' | 'queued' | 'pending' | 'rejected';
  txHash: string;
  amountUsdc?: number;
  reason?: string;
}

export interface DepositClaimDTO {
  id: string;
  txHash: string;
  status: string;
  failReason: string | null;
  attemptCount: number;
  lastCheckedAt: string | null;
  creditedAt: string | null;
  createdAt: string;
}

export const walletLinkSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid signature'),
});

export type WalletLinkInput = z.infer<typeof walletLinkSchema>;

export interface WalletChallengeDTO {
  message: string;
  expiresAt: string;
}

export interface WalletLinkResponseDTO {
  wallet: string;
}

export const walletTransactionsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  type: z.enum(['all', 'usdc', 'game']).default('all'),
  flow: z.enum(['all', 'gmt', 'in', 'out']).default('all'),
});

export type WalletTransactionsQuery = z.infer<typeof walletTransactionsQuerySchema>;

export const swapGmtSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  /** Stablecoin de origem. Default usdc (legado). */
  from: z.enum(['usdc', 'usdt']).default('usdc'),
});

export type SwapGmtInput = z.infer<typeof swapGmtSchema>;

export interface SwapGmtResultDTO {
  amount: number;
  from: 'usdc' | 'usdt';
  gmtBalance: number;
  usdcBalance: number;
  usdtBalance: number;
}
