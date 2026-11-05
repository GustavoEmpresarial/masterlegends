export const ChainEvent = {
  PlayerMinted: 'PlayerMinted',
  PlayerBurned: 'PlayerBurned',
  StaminaUpdated: 'StaminaUpdated',
  ItemListed: 'ItemListed',
  ItemSold: 'ItemSold',
  ListingCancelled: 'ListingCancelled',
  PlayersFused: 'PlayersFused',
  UsdcDeposited: 'UsdcDeposited',
  UsdcWithdrawn: 'UsdcWithdrawn',
} as const;

export type ChainEventName = (typeof ChainEvent)[keyof typeof ChainEvent];

export const INDEXED_CHAIN_EVENTS = [
  ChainEvent.PlayerMinted,
  ChainEvent.PlayerBurned,
  ChainEvent.ItemListed,
  ChainEvent.ItemSold,
  ChainEvent.PlayersFused,
  ChainEvent.UsdcDeposited,
  ChainEvent.UsdcWithdrawn,
] as const;
