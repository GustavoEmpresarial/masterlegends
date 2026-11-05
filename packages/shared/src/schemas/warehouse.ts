export const WarehouseItemType = {
  PLAYER_CARD: 'player_card',
  CONSUMABLE: 'consumable',
  STAMINA_BOOST: 'stamina_boost',
  GMT_PACK: 'gmt_pack',
  SCOUT_TICKET: 'scout_ticket',
  OVERWALL_BOOST: 'overwall_boost',
  TEMP_PLAYER: 'temp_player',
} as const;

export type WarehouseItemTypeName = (typeof WarehouseItemType)[keyof typeof WarehouseItemType];

export const WarehouseSource = {
  MARKETPLACE: 'marketplace',
  QUEST_REWARD: 'quest_reward',
  CHECKIN: 'checkin',
  ADMIN: 'admin',
  OFFERWALL: 'offerwall',
  /** Compras na Lojinha (stadium-shop) — únicas que vão pro almoxarifado hoje. */
  STADIUM_SHOP: 'stadium_shop',
} as const;

export type WarehouseSourceName = (typeof WarehouseSource)[keyof typeof WarehouseSource];

export interface WarehouseItemDTO {
  id: string;
  userId: string;
  itemType: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  rarity: number;
  quantity: number;
  data: Record<string, unknown>;
  source: string;
  sourceRef: string | null;
  claimed: boolean;
  claimedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseClaimResultDTO {
  itemId: string;
  itemType: string;
  claimed: boolean;
  details: Record<string, unknown>;
}

export interface WarehouseListResponseDTO {
  items: WarehouseItemDTO[];
  total: number;
  pending: number;
}

export interface OfferwallRewardDTO {
  id: string;
  userId: string;
  provider: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface ZeradsPtcLinkDTO {
  url: string;
  enabled: boolean;
}

export interface ZeradsPtcDailyStatDTO {
  day: string;
  zer: number;
  overwall: number;
  clicks: number;
}

export interface ZeradsPtcStatsDTO {
  todayOverwall: number;
  todayZer: number;
  todayClicks: number;
  lifetimeOverwall: number;
  lifetimeZer: number;
  lifetimeClicks: number;
  activeOverwall: number;
  daily: ZeradsPtcDailyStatDTO[];
}

export interface AdminWarehouseGrantInputDTO {
  userId: string;
  itemType: string;
  name: string;
  description?: string;
  imageUrl?: string;
  rarity?: number;
  quantity?: number;
  data?: Record<string, unknown>;
  expiresAt?: string;
}
