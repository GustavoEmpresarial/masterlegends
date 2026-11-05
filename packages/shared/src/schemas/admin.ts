import { z } from 'zod';

export const AdminRole = {
  SUPER: 'super',
  OPS: 'ops',
  SUPPORT: 'support',
} as const;

export type AdminRoleType = (typeof AdminRole)[keyof typeof AdminRole];

export const adminRoleSchema = z.enum(['super', 'ops', 'support']);

export const adminLoginSchema = z.object({
  login: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

export const adminVerify2faSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminVerify2faInput = z.infer<typeof adminVerify2faSchema>;

export interface AdminUserDTO {
  id: string;
  login: string;
  role: AdminRoleType;
  permissions?: import('./admin-panel.js').AdminPermissionType[];
}

export interface AdminSessionResponse {
  accessToken: string;
  admin: AdminUserDTO;
}

export interface AdminLoginChallengeResponse {
  challengeId: string;
  expiresIn: number;
}

export interface AdminOverviewDTO {
  // Users
  totalUsers: number;
  bannedUsers: number;
  newUsersToday: number;
  newUsers7d: number;
  usersWithLineup: number;

  // Financial
  depositsTodayUsdc: number;
  withdrawalsTodayUsdc: number;
  deposits7dUsdc: number;
  withdrawals7dUsdc: number;
  totalUsdcInGame: number;
  pendingWithdrawals: number;
  /** Card detalhado de saques na Visão Geral */
  withdrawalsCard?: import('./admin-panel.js').AdminOverviewWithdrawalCardDTO;

  // Mining
  lastMiningBlockNumber: number | null;
  lastMiningBlockAt: string | null;
  miningParticipantsLastBlock: number;
  totalMiningBlocksAllTime: number;
  miningPaused: boolean;

  // Game
  openTickets: number;
  totalReferrals: number;
  referrals7d: number;
  totalMints: number;
  mints7d: number;
  activePasses: number;
}
