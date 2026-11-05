export const EMAIL_QUEUE = 'email';
export const TELEGRAM_QUEUE = 'telegram';
export const CHAIN_INDEXER_QUEUE = 'chain-indexer';
export const REFERRAL_REWARDS_QUEUE = 'referral-rewards';
export const STAMINA_RECOVERY_QUEUE = 'stamina-recovery';
export const SEASON_RESET_QUEUE = 'season-reset';
export const MINING_QUEUE = 'mining';

export const ALL_QUEUE_NAMES = [
  EMAIL_QUEUE,
  TELEGRAM_QUEUE,
  CHAIN_INDEXER_QUEUE,
  REFERRAL_REWARDS_QUEUE,
  STAMINA_RECOVERY_QUEUE,
  SEASON_RESET_QUEUE,
  MINING_QUEUE,
] as const;

export type QueueName = (typeof ALL_QUEUE_NAMES)[number];
