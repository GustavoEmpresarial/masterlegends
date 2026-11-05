import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type {
  ClubDataDTO,
  InventoryResponse,
  LineupAssignment,
  ListingDTO,
  PassProgressDTO,
  ScoutMintResponse,
  ScoutRulesDTO,
  ScoutPlayerDTO,
  PenaltyStartResultDTO,
  PenaltyShootResultDTO,
  StadiumShopBuyResultDTO,
  StadiumShopItemDTO,
  StadiumViewDTO,
  VestiarioViewDTO,
  CheckInStatusDTO,
  CheckInClaimResultDTO,
  CtViewDTO,
  MinigamesCatalogDTO,
  MinigamePlayResultDTO,
  MergeRulesDTO,
  MergeResultDTO,
  PlayerProfileDTO,
  WalletSummaryDTO,
  WalletTransactionsDTO,
  WarehouseListResponseDTO,
  WarehouseClaimResultDTO,
  OfferwallRewardDTO,
  ZeradsPtcLinkDTO,
  ZeradsPtcStatsDTO,
} from '@mll/shared';
import { apiClient } from '../lib/api/client';
import { useAuth } from './useAuth';

export type ClubData = ClubDataDTO;
export type { ListingDTO, ScoutPlayerDTO, InventoryResponse, PassProgressDTO };
export type ScoutPlayer = ScoutPlayerDTO;

async function getJson<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await apiClient.get<T>(url, { params });
  return data;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await apiClient.post<T>(url, body);
  return data;
}

async function putJson<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await apiClient.put<T>(url, body);
  return data;
}

async function patchJson<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await apiClient.patch<T>(url, body);
  return data;
}

// Club
export function usePlayerProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getJson<PlayerProfileDTO>('/api/profile/'),
    enabled: Boolean(user?.id),
  });
}

export function useClub() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['club', user?.id],
    queryFn: async () => {
      try {
        return await getJson<ClubData>('/api/club/');
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!user,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) return false;
      return failureCount < 2;
    },
  });
}

export function useCreateClub() {
  const queryClient = useQueryClient();
  const { user, patchUser } = useAuth();
  return useMutation({
    mutationFn: (name: string) => postJson<ClubData>('/api/club/create', { name }),
    onSuccess: (club) => {
      queryClient.setQueryData(['club', user?.id], club);
      patchUser({ hasClub: true });
    },
  });
}

export function useInventory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['inventory', user?.id],
    queryFn: () => getJson<InventoryResponse>('/api/club/inventory'),
    enabled: !!user,
    refetchOnMount: 'always',
    refetchInterval: 30_000,
  });
}

export function useUpgradeBuilding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (building: string) => postJson<ClubData>(`/api/club/upgrade/${building}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club'] });
      queryClient.invalidateQueries({ queryKey: ['stadium-view'] });
      queryClient.invalidateQueries({ queryKey: ['ct'] });
    },
  });
}

export function useCtView() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['ct', user?.id],
    queryFn: () => getJson<CtViewDTO>('/api/ct'),
    enabled: !!user,
    refetchOnMount: 'always',
    refetchInterval: 30_000,
  });
}

export interface OfficeStaffStatusDTO {
  hired: boolean;
  hiredAt: string | null;
  lastBilledAt: string | null;
  nextBillingAt: string | null;
  weeklyUsdc: number;
  enabled: boolean;
  name: string;
  roleLabel: string;
  avatar: string;
  accent: string;
  perks: { icon: string; text: string }[];
  afflicted: boolean;
  afflictionExpiresAt: string | null;
}

export interface OfficeStatusDTO {
  treasurer: OfficeStaffStatusDTO;
  coach: OfficeStaffStatusDTO & { miningFeePct: number; staminaRecoveryPerHour: number };
  gmtBalance: number;
  usdcBalance: number;
}

export interface CoachFeeReportDTO {
  totalFees: number;
  txCount: number;
  lastAt: string | null;
  recent: Array<{
    id: string;
    amount: number;
    createdAt: string;
    blockNumber: number | null;
    gross: number | null;
    feePct: number | null;
  }>;
}

export function useOffice() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['office', user?.id],
    queryFn: () => getJson<OfficeStatusDTO>('/api/office'),
    enabled: !!user,
    refetchOnMount: 'always',
  });
}

export function useCoachFeeReport() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['office-coach-fees', user?.id],
    queryFn: () => getJson<CoachFeeReportDTO>('/api/office/coach-fees'),
    enabled: !!user,
    refetchOnMount: 'always',
  });
}

export interface OfficeAfflictionDTO {
  id: string;
  targetKind: 'coach' | 'treasurer' | 'base_player' | 'nft_player';
  code: string;
  note: string | null;
  expiresAt: string;
}

export function useOfficeAfflictions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['office-afflictions', user?.id],
    queryFn: () => getJson<{ items: OfficeAfflictionDTO[] }>('/api/office/afflictions/active'),
    enabled: !!user,
    refetchOnMount: 'always',
  });
}

export function useOfficeAction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ kind, action }: { kind: 'treasurer' | 'coach'; action: 'hire' | 'fire' }) =>
      postJson<OfficeStatusDTO>(`/api/office/${kind}/${action}`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['office', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['office-coach-fees', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['club', user?.id] });
    },
  });
}

export function useStadiumView() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['stadium-view', user?.id],
    queryFn: () => getJson<StadiumViewDTO>('/api/stadium/view'),
    enabled: !!user,
    refetchOnMount: 'always',
  });
}

export function useStadiumLicenses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['stadium-licenses', user?.id],
    queryFn: () => getJson<import('@mll/shared').StadiumLicenseCatalogDTO>('/api/stadium/licenses'),
    enabled: !!user,
    refetchOnMount: 'always',
  });
}

export function useStadiumLicenseAction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({
      templateId,
      action,
    }: {
      templateId: string;
      action: 'buy' | 'sign' | 'activate';
    }) =>
      postJson<import('@mll/shared').StadiumLicenseCatalogDTO>(
        `/api/stadium/licenses/${templateId}/${action}`,
        {},
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stadium-licenses', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['stadium-view', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['club', user?.id] });
    },
  });
}

export function useSaveLineup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (assignments: Record<string, LineupAssignment>) =>
      putJson<StadiumViewDTO>('/api/vestiario/lineup', { assignments }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vestiario', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['stadium-view', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['inventory', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['ct', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['events-board'] });
    },
  });
}

export function usePlayerStake() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ kind, playerId }: { kind: 'base' | 'nft'; playerId: string }) =>
      postJson<{ staked: boolean; stakeGmt: number }>(`/api/players/${kind}/${playerId}/stake`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vestiario', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['stadium-view', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['inventory', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['club', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['wallet', user?.id] });
    },
  });
}

export function usePlayerUnstake() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ kind, playerId }: { kind: 'base' | 'nft'; playerId: string }) =>
      postJson<{ staked: boolean; stakeGmt: number }>(`/api/players/${kind}/${playerId}/unstake`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vestiario', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['stadium-view', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['inventory', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['club', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['wallet', user?.id] });
    },
  });
}

export function useVestiario() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['vestiario', user?.id],
    queryFn: () => getJson<VestiarioViewDTO>('/api/vestiario'),
    enabled: !!user,
    refetchOnMount: 'always',
    refetchInterval: 30_000,
  });
}

export function useDailyRest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: () => postJson<{ restoredCount: number }>('/api/vestiario/rest'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vestiario', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['inventory', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['club', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['ct', user?.id] });
    },
  });
}

export function useCheckInStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['checkin', user?.id],
    queryFn: () => getJson<CheckInStatusDTO>('/api/checkin'),
    enabled: !!user,
    refetchOnMount: 'always',
  });
}

export function useClaimCheckIn() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: () => postJson<CheckInClaimResultDTO>('/api/checkin/claim'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['checkin', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['club', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['mining', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useStadiumShop() {
  return useQuery({
    queryKey: ['stadium-shop'],
    queryFn: () =>
      getJson<{ items: StadiumShopItemDTO[]; gear: import('@mll/shared').GearCatalogItemDTO[] }>(
        '/api/stadium/shop',
      ),
  });
}

export function useBuyStadiumShopItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (body: { itemId: string }) =>
      postJson<StadiumShopBuyResultDTO>('/api/stadium/shop/buy', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stadium-shop'] });
      void queryClient.invalidateQueries({ queryKey: ['club', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['warehouse', user?.id] });
    },
  });
}

export function useBuyGear() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (body: { catalogItemId: string }) =>
      postJson<import('@mll/shared').GearBuyResultDTO>('/api/stadium/shop/buy-gear', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stadium-shop'] });
      void queryClient.invalidateQueries({ queryKey: ['gear-bag', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['club', user?.id] });
    },
  });
}

export function useGearBag() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['gear-bag', user?.id],
    queryFn: () => getJson<import('@mll/shared').GearBagResponse>('/api/club/gear'),
    enabled: !!user,
  });
}

export function useEquipGear() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (body: { userGearId: string; playerId: string; kind: 'base' | 'nft' }) =>
      postJson<import('@mll/shared').GearBagResponse>('/api/club/gear/equip', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gear-bag', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['inventory', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['club', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['stadium', user?.id] });
    },
  });
}

export function useUnequipGear() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (body: { playerId: string; kind: 'base' | 'nft'; slot: string }) =>
      postJson<import('@mll/shared').GearBagResponse>('/api/club/gear/unequip', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gear-bag', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['inventory', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['club', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['stadium', user?.id] });
    },
  });
}

export function useMinigames() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['minigames', user?.id],
    queryFn: () => getJson<MinigamesCatalogDTO>('/api/minigames'),
    enabled: !!user,
  });
}

export function usePenaltyStart() {
  return useMutation({
    mutationFn: (input: { playerId: string; kind: 'base' | 'nft' }) =>
      postJson<PenaltyStartResultDTO>('/api/minigames/recovery_penalty/start', input),
  });
}

export function usePenaltyShoot() {
  return useMutation({
    mutationFn: (input: { sessionId: string; nx: number; ny: number }) =>
      postJson<PenaltyShootResultDTO>('/api/minigames/recovery_penalty/shoot', input),
  });
}

export function usePlayMinigame() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: {
      id: string;
      playerId: string;
      kind: 'base' | 'nft';
      sessionId: string;
    }) =>
      postJson<MinigamePlayResultDTO>(`/api/minigames/${input.id}/play`, {
        playerId: input.playerId,
        kind: input.kind,
        sessionId: input.sessionId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['minigames', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['vestiario', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['inventory', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['ct', user?.id] });
    },
  });
}

// Marketplace
export function useListings(filters?: Record<string, unknown>) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['listings', filters],
    queryFn: async () => {
      const data = await getJson<{ listings: ListingDTO[] }>('/api/marketplace/search', filters);
      void queryClient.invalidateQueries({ queryKey: ['events-board'] });
      return data.listings;
    },
  });
}

export function useMyListings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-listings', user?.id],
    queryFn: async () => {
      const data = await getJson<{ listings: ListingDTO[] }>('/api/marketplace/my-listings');
      return data.listings;
    },
    enabled: !!user,
    refetchOnMount: 'always',
  });
}

export interface WalletHistoryEntry {
  id: string;
  action: 'linked' | 'unlinked';
  wallet: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export function useWalletHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wallet-history', user?.id],
    queryFn: () => getJson<{ history: WalletHistoryEntry[] }>('/api/wallet/history'),
    enabled: !!user,
    refetchOnMount: 'always',
  });
}

export function useMarketplaceInfo() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['marketplace-info'],
    queryFn: async () => {
      const data = await getJson<{ feeBps: number }>('/api/marketplace/info');
      void queryClient.invalidateQueries({ queryKey: ['events-board'] });
      return data;
    },
    staleTime: 60_000,
  });
}

export function useListItemsBulk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: Array<{ basePlayerId: string; price: number }>) =>
      postJson<{ results: Array<{ ok: boolean; basePlayerId?: string; error?: string }> }>(
        '/api/marketplace/list-bulk',
        { items },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useListItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { basePlayerId: string; price: number }) =>
      postJson('/api/marketplace/list', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useBuyListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) => postJson(`/api/marketplace/buy/${listingId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['club'] });
      queryClient.invalidateQueries({ queryKey: ['pass'] });
    },
  });
}

export function useCancelListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) => postJson(`/api/marketplace/cancel/${listingId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateListingPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, price }: { listingId: string; price: number }) =>
      patchJson(`/api/marketplace/listings/${listingId}/price`, { price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
    },
  });
}

// Merger
export function useMergeRules() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['merge-rules'],
    queryFn: () => getJson<MergeRulesDTO>('/api/merger/rules'),
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useMergeFuse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { playerIds: string[]; payWith?: 'gmt' }) =>
      postJson<MergeResultDTO>('/api/merger/fuse', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['pass'] });
    },
  });
}

// Scout
export function useScoutRules() {
  return useQuery({
    queryKey: ['scout', 'rules'],
    queryFn: () => getJson<ScoutRulesDTO>('/api/scout/rules'),
    staleTime: 60_000,
  });
}

export function useScoutMint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quantity: number) =>
      postJson<ScoutMintResponse>('/api/scout/mint', { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['pass'] });
      void queryClient.invalidateQueries({ queryKey: ['events-board'] });
    },
  });
}

// PvP
export function useFindMatch() {
  return useMutation({ mutationFn: () => postJson('/api/pvp/match') });
}

// Pass
export function usePassProgress() {
  return useQuery({
    queryKey: ['pass'],
    queryFn: () => getJson<PassProgressDTO>('/api/pass/progress'),
    refetchOnMount: 'always',
  });
}

export function useClaimPassLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: number | { level: number; seasonId?: number }) => {
      const level = typeof input === 'number' ? input : input.level;
      const seasonId = typeof input === 'number' ? undefined : input.seasonId;
      return postJson<PassProgressDTO>(`/api/pass/claim/${level}`, seasonId == null ? {} : { seasonId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pass'] });
      queryClient.invalidateQueries({ queryKey: ['club'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse'] });
      queryClient.invalidateQueries({ queryKey: ['gear-bag'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
}

export function useBuyPassPremium() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (seasonId?: number) => postJson<PassProgressDTO>('/api/pass/premium', seasonId == null ? {} : { seasonId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pass'] });
      queryClient.invalidateQueries({ queryKey: ['club'] });
    },
  });
}

// Wallet
export function useWalletSummary() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wallet', 'summary', user?.id],
    queryFn: () => getJson<WalletSummaryDTO>('/api/wallet/summary'),
    enabled: !!user,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export function useWalletSwap() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (body: { amount: number }) =>
      postJson<{ amount: number; gmtBalance: number; usdcBalance: number }>(
        '/api/wallet/swap',
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wallet', 'summary', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['club', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['office', user?.id] });
    },
  });
}

export function useMiningAnalytics() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wallet', 'mining-analytics', user?.id],
    queryFn: () => getJson<import('@mll/shared').MiningAnalyticsDTO>('/api/wallet/mining-analytics'),
    enabled: !!user,
    staleTime: 20_000,
  });
}

export function useWalletTransactions(filters?: { cursor?: string; type?: string; flow?: string }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wallet', 'transactions', user?.id, filters],
    queryFn: () =>
      getJson<WalletTransactionsDTO>('/api/wallet/transactions', {
        limit: 20,
        type: filters?.type ?? 'all',
        flow: filters?.flow ?? 'all',
        ...(filters?.cursor ? { cursor: filters.cursor } : {}),
      }),
    enabled: !!user,
  });
}

// Referrals
export function useReferralStats() {
  return useQuery({
    queryKey: ['referrals'],
    queryFn: () => getJson<{ totalReferrals: number; totalEarned: number }>('/api/referrals/stats'),
  });
}

// Ranking
export function useClubRanking() {
  return useQuery({
    queryKey: ['ranking', 'clubs'],
    queryFn: () => getJson<import('@mll/shared').ClubRankingDTO>('/stats/ranking/clubs'),
    staleTime: 15_000,
  });
}

export function usePlayerRanking() {
  return useQuery({
    queryKey: ['ranking', 'players'],
    queryFn: () => getJson<import('@mll/shared').PlayerRankingDTO>('/stats/ranking/players'),
    staleTime: 60_000,
  });
}

export function useClubRankingProfile(clubName: string | null) {
  return useQuery({
    queryKey: ['ranking', 'club', clubName],
    queryFn: () =>
      getJson<import('@mll/shared').ClubRankingProfileDTO>(
        `/stats/ranking/clubs/${encodeURIComponent(clubName!)}`,
      ),
    enabled: Boolean(clubName),
  });
}

export function useSocialFeed() {
  return useQuery({
    queryKey: ['social', 'feed'],
    queryFn: () => getJson<{ videos: import('@mll/shared').YoutubeVideoDTO[] }>('/stats/social/videos'),
    staleTime: 30_000,
  });
}

export function useSocialMe(enabled: boolean) {
  return useQuery({
    queryKey: ['social', 'me'],
    queryFn: () => getJson<import('@mll/shared').SocialMeDTO>('/api/social/me'),
    enabled,
  });
}

// Warehouse (Almoxarifado) — itens comprados no mercado e recebidos das tasks/eventos
export function useWarehouse() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['warehouse', user?.id],
    queryFn: () => getJson<WarehouseListResponseDTO>('/api/warehouse/'),
    enabled: !!user,
    refetchOnMount: 'always',
    refetchInterval: 30_000,
  });
}

export function useClaimWarehouseItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (itemId: string) =>
      postJson<WarehouseClaimResultDTO>(`/api/warehouse/${itemId}/claim`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['warehouse', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['inventory', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['club', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
}

// Offerwall (Zerads) — recompensas creditadas via ofertas externas
export function useOfferwallRewards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['offerwall-rewards', user?.id],
    queryFn: () => getJson<OfferwallRewardDTO[]>('/api/offerwall/rewards'),
    enabled: !!user,
    refetchInterval: 30_000,
  });
}

// Zerads PTC — link personalizado de clique
export function useZeradsPtcLink() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['zerads-ptc-link', user?.id],
    queryFn: () => getJson<ZeradsPtcLinkDTO>('/api/offerwall/zerads/link'),
    enabled: !!user,
  });
}

// Zerads PTC — estatísticas diárias (Overwall temporário creditado via cliques)
export function useZeradsPtcStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['zerads-ptc-stats', user?.id],
    queryFn: () => getJson<ZeradsPtcStatsDTO>('/api/offerwall/zerads/stats'),
    enabled: !!user,
    refetchInterval: 60_000,
  });
}
