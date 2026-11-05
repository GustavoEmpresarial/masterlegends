import { z } from 'zod';
import type { ScoutRarityWeights } from '../economy/scout.js';

export const AdminPermission = {
  VIEW_USERS: 'view_users',
  MANAGE_USERS: 'manage_users',
  VIEW_REPORTS: 'view_reports',
  MANAGE_WITHDRAWALS: 'manage_withdrawals',
  MANAGE_WALLET_CONFIG: 'manage_wallet_config',
  MANAGE_ANNOUNCEMENTS: 'manage_announcements',
  MANAGE_SUPPORT: 'manage_support',
  MANAGE_ITEMS: 'manage_items',
  MANAGE_STADIUMS: 'manage_stadiums',
  MANAGE_PASS: 'manage_pass',
  MANAGE_EVENTS: 'manage_events',
  MANAGE_SOCIAL: 'manage_social',
  VIEW_REFERRALS: 'view_referrals',
  MANAGE_PLATFORM: 'manage_platform',
  VIEW_AUDIT: 'view_audit',
  VIEW_BULL_BOARD: 'view_bull_board',
} as const;

export type AdminPermissionType = (typeof AdminPermission)[keyof typeof AdminPermission];

export function adminHasPermission(role: string, permission: AdminPermissionType): boolean {
  const matrix: Record<string, AdminPermissionType[]> = {
    super: Object.values(AdminPermission),
    ops: [AdminPermission.VIEW_USERS],
    support: [
      AdminPermission.VIEW_USERS,
      AdminPermission.MANAGE_USERS,
      AdminPermission.MANAGE_SUPPORT,
    ],
  };
  return matrix[role]?.includes(permission) ?? false;
}

export const banUserSchema = z.object({
  reason: z.string().min(3).max(255),
});

export const adminResetPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

export const adminUsernameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric or underscore');

export const adminUpdateUserProfileSchema = z.object({
  username: adminUsernameSchema.optional(),
  email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
  clubName: z.string().min(2).max(32).optional(),
  wallet: z
    .union([
      z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
      z.literal(''),
    ])
    .optional()
    .nullable(),
  gmtBalance: z.number().min(0).optional(),
  usdcBalance: z.number().min(0).optional(),
  usdtBalance: z.number().min(0).optional(),
  referralCode: z
    .string()
    .min(4)
    .max(8)
    .regex(/^[A-Za-z0-9]+$/)
    .optional(),
  emailVerified: z.boolean().optional(),
  failedLoginCount: z.number().int().min(0).max(100).optional(),
  clearAccountLock: z.boolean().optional(),
  clubStadiumLvl: z.number().int().min(1).max(10).optional(),
  clubCtLvl: z.number().int().min(1).max(10).optional(),
  clubTreasurerLvl: z.number().int().min(1).max(10).optional(),
  clubTrophyRoomLvl: z.number().int().min(1).max(10).optional(),
  clubTotalOverwall: z.number().int().min(0).optional(),
});

export type AdminUpdateUserProfileInput = z.infer<typeof adminUpdateUserProfileSchema>;

export const deactivateUserSchema = z.object({
  reason: z.string().min(3).max(255),
});

export const rejectWithdrawalSchema = z.object({
  reason: z.string().min(3).max(512),
});

export const walletConfigPatchSchema = z.object({
  minDepositUsdc: z.number().positive().optional(),
  minWithdrawUsdc: z.number().positive().optional(),
  withdrawFeePct: z.number().min(0).max(1).optional(),
  withdrawalsPaused: z.boolean().optional(),
  miningBlockRewardUsdc: z.number().positive().optional(),
  miningBlockIntervalMin: z.number().int().min(1).max(1440).optional(),
  registrationOpen: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).nullable().optional(),
  referralBonusPct: z.number().min(0).max(1).optional(),
  treasurerWeeklyUsdc: z.number().min(0).optional(),
  coachWeeklyUsdc: z.number().min(0).optional(),
  coachMiningFeePct: z.number().min(0).max(1).optional(),
  marketplaceFeeBps: z.number().int().min(0).max(10000).optional(),
  mergeDiscountPct: z.number().min(0).max(1).optional(),
  scoutDiscountPct: z.number().min(0).max(1).optional(),
  scoutRarityWeights: z
    .object({
      common: z.number().min(0),
      uncommon: z.number().min(0),
      rare: z.number().min(0),
      'super-rare': z.number().min(0),
      epic: z.number().min(0),
      legendary: z.number().min(0),
    })
    .refine((weights) => Object.values(weights).some((weight) => weight > 0), {
      message: 'At least one rarity weight must be greater than zero',
    })
    .optional(),
  referralNftName: z.string().max(64).optional(),
  referralNftImageUrl: z.string().max(512).nullable().optional(),
  referralNftOverwall: z.number().int().min(1).max(1000000).optional(),
  referralNftPosition: z.number().int().min(0).max(3).optional(),
  referralNftDurationDays: z.number().int().min(1).max(365).optional(),
  referralGiftNftName: z.string().max(64).optional(),
  referralGiftNftImageUrl: z.string().max(512).nullable().optional(),
  referralGiftNftOverwall: z.number().int().min(1).max(1000000).optional(),
  referralGiftNftPosition: z.number().int().min(0).max(3).optional(),
  socialRewardNftName: z.string().max(64).optional(),
  socialRewardNftImageUrl: z.string().max(512).nullable().optional(),
  socialRewardNftOverwall: z.number().int().min(1).max(1000000).optional(),
  socialRewardNftPosition: z.number().int().min(0).max(3).optional(),
  socialRewardNftDays: z.number().int().min(1).max(9999).optional(),
  checkInStreakPlayerName: z.string().max(64).optional(),
  checkInStreakPlayerImageUrl: z.string().max(512).nullable().optional(),
  checkInStreakPlayerOverwall: z.number().int().min(1).max(1000000).optional(),
  checkInStreakPlayerPosition: z.number().int().min(0).max(3).optional(),
  checkInStreakPlayerDays: z.number().int().min(1).max(9999).optional(),
  checkInStreakThreshold: z.number().int().min(1).max(365).optional(),
  allocationJson: z
    .array(
      z.object({
        label: z.string().min(1).max(64),
        pct: z.number().min(0).max(100),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      }),
    )
    .max(10)
    .optional(),
});

export const announcementCreateSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(5000),
  active: z.boolean().default(false),
  dismissible: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export const announcementPatchSchema = announcementCreateSchema.partial();

export const supportTicketCreateSchema = z.object({
  subject: z.string().min(3).max(200),
  category: z.enum(['general', 'wallet', 'account', 'gameplay', 'other']).default('general'),
  message: z.string().max(5000).default(''),
});

export const supportMessageSchema = z.object({
  body: z.string().max(5000).default(''),
});

export const supportTicketPatchSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  assignedTo: z.string().max(64).optional().nullable(),
});

export const approveWithdrawalSchema = z.object({
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash')
    .optional()
    .nullable(),
  paymentMethod: z.enum(['metamask', 'manual']).optional().nullable(),
});

export const withdrawRequestSchema = z.object({
  amountUsdc: z.number().positive(),
  satspayEmail: z.string().trim().email().max(254),
});

export const adminWithdrawalHistoryQuerySchema = z.object({
  status: z.enum(['pending', 'completed', 'rejected', 'cancelled', 'all']).optional(),
  paymentMethod: z.enum(['metamask', 'manual', 'satspay', 'all']).optional(),
  user: z.string().max(128).optional(),
  email: z.string().max(128).optional(),
  wallet: z.string().max(66).optional(),
  hash: z.string().max(66).optional(),
  q: z.string().max(128).optional(),
  minAmount: z.coerce.number().nonnegative().optional(),
  maxAmount: z.coerce.number().nonnegative().optional(),
  from: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
  to: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
  period: z.enum(['today', 'yesterday', '7d', '30d', 'custom', 'all']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['createdAt_desc', 'createdAt_asc', 'amount_desc', 'amount_asc']).optional(),
});

export interface AdminUserListItemDTO {
  id: string;
  email: string | null;
  username: string | null;
  wallet: string | null;
  emailVerifiedAt: string | null;
  bannedAt: string | null;
  banReason: string | null;
  gmtBalance: number;
  usdcBalance: number;
  usdtBalance: number;
  createdAt: string;
  clubName?: string | null;
  disabled?: boolean;
  isDepositor?: boolean;
  openTickets?: number;
  pendingWithdrawals?: number;
}

export interface AdminUserDetailDTO extends AdminUserListItemDTO {
  failedLoginCount: number;
  lockedUntil: string | null;
  bannedBy: string | null;
  clubName: string | null;
  openTickets: number;
  pendingWithdrawals: number;
  disabled: boolean;
}

export interface AdminUserClubDTO {
  name: string;
  stadiumLvl: number;
  ctLvl: number;
  treasurerLvl: number;
  trophyRoomLvl: number;
  totalOverwall: number;
  treasurerHired: boolean;
  coachHired: boolean;
  createdAt: string;
}

export interface AdminUserInventoryItemDTO {
  id: string;
  kind: 'base' | 'nft';
  name: string | null;
  rarity: string;
  overwall: number;
  position: string;
  listed: boolean;
  imageUrl: string | null;
  tokenId: string | null;
}

export interface AdminUserMarketplaceListingDTO {
  id: string;
  kind: 'base' | 'nft';
  playerId: string | null;
  tokenId: string | null;
  name: string | null;
  rarity: string;
  overwall: number;
  position: string;
  priceGmt: number;
  imageUrl: string | null;
  listedAt: string;
}

export interface AdminUserActivityLogDTO {
  id: string;
  source: 'balance' | 'wallet' | 'security';
  label: string;
  txType?: string;
  detail: string | null;
  amount: number | null;
  createdAt: string;
}

export interface AdminUserWalletHistoryDTO {
  action: 'linked' | 'unlinked';
  wallet: string | null;
  createdAt: string;
}

export interface AdminUserAccountDTO extends AdminUserDetailDTO {
  referralCode: string;
  referredByCode: string | null;
  lastLoginAt: string | null;
  walletHistory: AdminUserWalletHistoryDTO[];
  club: AdminUserClubDTO | null;
  inventory: {
    basePlayers: AdminUserInventoryItemDTO[];
    nfts: AdminUserInventoryItemDTO[];
    total: number;
  };
  marketplaceListings: AdminUserMarketplaceListingDTO[];
  activityLogs: AdminUserActivityLogDTO[];
}

export interface AdminReferralCommissionDTO {
  id: string;
  referrerId: string;
  referrerLabel: string;
  referredId: string;
  referredLabel: string;
  sourceAmountUsdc: number;
  commissionGmt: number;
  commissionUsdc: number;
  status: string;
  txHash: string | null;
  createdAt: string;
}

export interface AdminReferralCommissionsOverviewDTO {
  totalCommissionsGmt: number;
  totalDepositedUsdc: number;
  totalEvents: number;
  byReferrer: Array<{
    referrerId: string;
    referrerLabel: string;
    referrerCode: string | null;
    eventsCount: number;
    totalDepositedUsdc: number;
    totalCommissionGmt: number;
  }>;
}

export const adminPermissionConfigSchema = z.object({
  permissions: z.array(z.string()),
});

export type AdminPermissionConfigInput = z.infer<typeof adminPermissionConfigSchema>;

export interface AdminPermissionConfigDTO {
  adminId: string;
  permissions: AdminPermissionType[];
  updatedBy: string | null;
  updatedAt: string;
}

export interface AdminListItemDTO {
  id: string;
  login: string;
  email: string;
  role: string;
  permissionConfig: AdminPermissionConfigDTO | null;
}

export interface AdminDashboardDTO {
  totalUsers: number;
  bannedUsers: number;
  pendingWithdrawals: number;
  openTickets: number;
  depositsTodayUsdc: number;
  withdrawalsTodayUsdc: number;
}

export interface AdminForecastDTO {
  // per-day estimates (3 methods)
  medianDaily: number;
  trimmedMeanDaily: number;   // 10% trim each side
  ewmaDaily: number;          // exponential weighted moving average (λ=0.85)
  // projected totals (use trimmedMean as "best estimate")
  best7d: number;
  best30d: number;
  // confidence spread (median vs trimmedMean delta as %)
  confidencePct: number;
  // raw inputs used
  activeDays: number;         // days with at least 1 transaction
  zeroDays: number;           // days with no transactions in window
}

export interface AdminReportSummaryDTO {
  depositCount: number;
  depositVolumeUsdc: number;
  withdrawalCount: number;
  withdrawalVolumeUsdc: number;
  avgDepositUsdc: number;
  avgWithdrawalUsdc: number;
  medianDepositUsdc: number;
  medianWithdrawalUsdc: number;
  netUsdc: number;
  uniqueDepositors: number;
  uniqueWithdrawers: number;
  forecastDeposits: AdminForecastDTO;
  forecastWithdrawals: AdminForecastDTO;
  // daily buckets for sparkline (last 30d)
  dailyDeposits: Array<{ date: string; volume: number; count: number }>;
  dailyWithdrawals: Array<{ date: string; volume: number; count: number }>;
  // top depositors
  topDepositors: Array<{ userId: string; username: string | null; email: string | null; total: number; count: number }>;
  from: string | null;
  to: string | null;
}

export interface AdminLedgerRowDTO {
  id: string;
  userId: string;
  username: string | null;
  email: string | null;
  amountUsdc: number;
  txHash: string;
  status: string;
  createdAt: string;
}

export interface WithdrawalRequestDTO {
  id: string;
  userId: string;
  username: string | null;
  email: string | null;
  wallet: string;
  requestedUsdc: number;
  feeUsdc: number;
  amountUsdc: number;
  /** Moeda dos valores acima — usdt (padrão a partir de 01/08/2026) | usdc (saques legados). */
  currency: string;
  status: string;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  txHash: string | null;
  /** E-mail da conta SatsPay que recebe. Null em saques on-chain antigos. */
  satspayEmail: string | null;
  /** Código da última recusa da SatsPay, enquanto o pedido segue pendente. */
  satspayError: string | null;
  paymentMethod: string | null;
  notes: string | null;
  requestIp: string | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface WithdrawalHistorySummaryDTO {
  count: number;
  totalRequestedUsdc: number;
  totalPaidUsdc: number;
  totalPendingUsdc: number;
  totalRejectedUsdc: number;
  countPending: number;
  countPaid: number;
  countRejected: number;
  avgTicketUsdc: number | null;
  maxPaidUsdc: number | null;
  minPaidUsdc: number | null;
  avgProcessMinutes: number | null;
}

export interface WithdrawalHistoryChartsDTO {
  byDay: Array<{ date: string; count: number; paidUsdc: number }>;
  byMonth: Array<{ month: string; count: number; paidUsdc: number }>;
  statusBreakdown: Array<{ status: string; count: number; amountUsdc: number }>;
  topUsers: Array<{
    userId: string;
    username: string | null;
    email: string | null;
    paidUsdc: number;
    count: number;
  }>;
}

export interface WithdrawalHistoryResponseDTO {
  items: WithdrawalRequestDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: WithdrawalHistorySummaryDTO;
  charts: WithdrawalHistoryChartsDTO;
}

export interface AdminOverviewWithdrawalCardDTO {
  requestedToday: number;
  paidToday: number;
  pending: number;
  rejectedToday: number;
  paidTodayUsdc: number;
  paidMonthUsdc: number;
  recent: Array<{
    id: string;
    username: string | null;
    amountUsdc: number;
    currency: string;
    status: string;
    createdAt: string;
    txHash?: string | null;
  }>;
}

export interface PlatformConfigDTO {
  minDepositUsdc: number;
  minWithdrawUsdc: number;
  withdrawFeePct: number;
  withdrawalsPaused: boolean;
  vaultAddress: string | null;
  chainId: number;
  miningBlockRewardUsdc: number;
  miningBlockIntervalMin: number;
  miningPaused: boolean;
  registrationOpen: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  referralBonusPct: number;
  treasurerWeeklyUsdc: number;
  coachWeeklyUsdc: number;
  coachMiningFeePct: number;
  marketplaceFeeBps: number;
  mergeDiscountPct: number;
  scoutDiscountPct: number;
  scoutRarityWeights: ScoutRarityWeights;
  referralNftName: string;
  referralNftImageUrl: string | null;
  referralNftOverwall: number;
  referralNftPosition: number;
  referralNftDurationDays: number;
  referralGiftNftName: string;
  referralGiftNftImageUrl: string | null;
  referralGiftNftOverwall: number;
  referralGiftNftPosition: number;
  socialRewardNftName: string;
  socialRewardNftImageUrl: string | null;
  socialRewardNftOverwall: number;
  socialRewardNftPosition: number;
  socialRewardNftDays: number;
  checkInStreakPlayerName: string;
  checkInStreakPlayerImageUrl: string | null;
  checkInStreakPlayerOverwall: number;
  checkInStreakPlayerPosition: number;
  checkInStreakPlayerDays: number;
  checkInStreakThreshold: number;
  allocationJson: Array<{ label: string; pct: number; color?: string }>;
  updatedBy: string | null;
  updatedAt: string;
}

export interface SiteAnnouncementDTO {
  id: string;
  title: string;
  body: string;
  active: boolean;
  dismissible: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dismissalsCount?: number;
}

export interface SupportTicketDTO {
  id: string;
  userId: string;
  username: string | null;
  userEmail: string | null;
  userWallet: string | null;
  userIsDepositor: boolean;
  userHasClub: boolean;
  subject: string;
  category: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  hasUnreadAdminReply: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
}

export interface SupportAttachmentDTO {
  id: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface SupportMessageDTO {
  id: string;
  ticketId: string;
  authorType: 'user' | 'admin';
  authorId: string;
  body: string;
  createdAt: string;
  attachments: SupportAttachmentDTO[];
}

export interface SupportTicketDetailDTO extends SupportTicketDTO {
  messages: SupportMessageDTO[];
}

export type AdminRoiAlertLevel = 'ok' | 'warning' | 'critical';

export interface AdminRoiAuditCheckDTO {
  id: string;
  level: AdminRoiAlertLevel;
  title: string;
  detail: string;
}

export interface AdminUserRoiBlockRowDTO {
  blockNumber: number;
  minedAt: string;
  userOverwall: number;
  networkOverwall: number;
  sharePct: number;
  blockRewardUsdc: number;
  expectedUsdc: number;
  paidUsdc: number;
  driftUsdc: number;
}

export interface AdminUserRoiDTO {
  userId: string;
  username: string | null;
  email: string | null;
  config: {
    miningBlockRewardUsdc: number;
    miningBlockIntervalMin: number;
    miningPaused: boolean;
  };
  balances: {
    currentUsdc: number;
    /** Saldo USDT — ganhos de mineração sacáveis (a partir de 01/08/2026). */
    currentUsdt: number;
    ledgerUsdcSum: number;
    driftUsdc: number;
  };
  capital: {
    depositsUsdc: number;
    depositCount: number;
    adminCreditsUsdc: number;
    adminCreditCount: number;
    adminDebitsUsdc: number;
    adminDebitCount: number;
    withdrawalsUsdc: number;
    withdrawalCount: number;
    netCapitalIn: number;
  };
  mining: {
    blocksParticipated: number;
    totalPaidUsdc: number;
    totalLedgerUsdc: number;
    ledgerVsRewardDriftUsdc: number;
    expectedShareUsdc: number;
    shareVsPaidDriftUsdc: number;
    lifetimeEarnedUsdc: number;
    avgPerBlockUsdc: number;
    last24hUsdc: number;
    last24hBlocks: number;
    blocksPerDay: number;
    estimatedDailyUsdc: number;
  };
  flows: {
    otherCreditsUsdc: number;
    otherDebitsUsdc: number;
    netGameFlowUsdc: number;
  };
  roi: {
    percentOnCapital: number | null;
    dailyPercentOnCapital: number | null;
    alertLevel: AdminRoiAlertLevel;
    alerts: string[];
  };
  recentBlocks: AdminUserRoiBlockRowDTO[];
}

export interface AdminPlatformRoiUserAlertDTO {
  userId: string;
  username: string | null;
  email: string | null;
  driftUsdc: number;
  kind: 'ledger_vs_rewards' | 'balance_drift' | 'over_share';
}

export interface AdminUserRoiListItemDTO {
  userId: string;
  username: string | null;
  email: string | null;
  netCapitalIn: number;
  totalPaidUsdc: number;
  last24hUsdc: number;
  currentUsdc: number;
  /** Saldo USDT — ganhos de mineração sacáveis (a partir de 01/08/2026). */
  currentUsdt: number;
  roiPercent: number | null;
  dailyRoiPercent: number | null;
  alertLevel: AdminRoiAlertLevel;
}

export interface AdminPlatformRoiDTO {
  /** Início da janela de auditoria (ISO). Pool/ledger/ROI de patrocínios só contam a partir daqui. */
  auditSinceAt: string;
  config: {
    miningBlockRewardUsdc: number;
    miningBlockIntervalMin: number;
    miningPaused: boolean;
    blocksPerDay: number;
    expectedDailyPoolUsdc: number;
    /** Média da cota gravada nos blocos das últimas 24h (pode diferir se a config mudou). */
    last24hAvgBlockRewardUsdc: number;
    /** Pool esperado nas últimas 24h usando a cota **atual** da config. */
    last24hExpectedPoolAtCurrentRateUsdc: number;
    /** Blocos nas últimas 24h com cota diferente da configurada agora. */
    last24hLegacyBlockCount: number;
  };
  totals: {
    blockCount: number;
    /** Soma de rewardUsdc gravado em cada bloco (desde auditSinceAt). */
    historicalPoolUsdc: number;
    distributedUsdc: number;
    ledgerMiningUsdc: number;
    poolVsDistributedDriftUsdc: number;
    ledgerVsDistributedDriftUsdc: number;
    last24hBlocks: number;
    /** Soma do rewardUsdc registrado nos blocos das últimas 24h. */
    last24hRecordedPoolUsdc: number;
    last24hDistributedUsdc: number;
    last24hDriftUsdc: number;
    /** Δ entre pool registrado 24h e o esperado com cota atual. */
    last24hConfigDriftUsdc: number;
  };
  capital: {
    totalDepositsUsdc: number;
    totalAdminCreditsUsdc: number;
    totalWithdrawalsUsdc: number;
    totalAdminDebitsUsdc: number;
    netCapitalInUsdc: number;
  };
  roi: {
    percentOnCapital: number | null;
    dailyPercentOnCapital: number | null;
    payoutVsPoolPercent: number | null;
    minersCount: number;
    depositorsCount: number;
  };
  alertLevel: AdminRoiAlertLevel;
  alerts: string[];
  auditChecks: AdminRoiAuditCheckDTO[];
  topDrifts: AdminPlatformRoiUserAlertDTO[];
}
