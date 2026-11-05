export const MgtTxType = {
  STARTER: 'starter',
  FARM: 'farm',
  SCOUT: 'scout',
  MERGE: 'merge',
  MARKETPLACE_BUY: 'marketplace_buy',
  MARKETPLACE_SELL: 'marketplace_sell',
  UPGRADE: 'upgrade',
  PASS_CLAIM: 'pass_claim',
  PASS_PREMIUM: 'pass_premium',
  REFERRAL: 'referral',
  STADIUM_SHOP: 'stadium_shop',
  GEAR_SHOP: 'gear_shop',
  BONECO: 'boneco',
  OFFICE_HIRE: 'office_hire',
  OFFICE_FEE: 'office_fee',
  COACH_FEE: 'coach_fee',
  USDC_DEPOSIT: 'usdc_deposit',
  USDC_WITHDRAW: 'usdc_withdraw',
  /** Saques passam a ser pagos em USDT (a partir de 01/08/2026). */
  USDT_WITHDRAW: 'usdt_withdraw',
  SWAP_USDC_TO_GMT: 'swap_usdc_to_gmt',
  SWAP_USDT_TO_GMT: 'swap_usdt_to_gmt',
  SWAP_GMT_TO_USDC: 'swap_gmt_to_usdc',
  /** Mineração passa a creditar em USDT (a partir de 01/08/2026). */
  MINING_CLAIM: 'mining_claim',
  EVENT_REWARD: 'event_reward',
  STADIUM_LICENSE: 'stadium_license',
  PLAYER_STAKE: 'player_stake',
  PLAYER_UNSTAKE: 'player_unstake',
  PVP_STAKE: 'pvp_stake',
  PVP_WIN: 'pvp_win',
  PVP_REFUND: 'pvp_refund',
} as const;

export type MgtTxTypeName = (typeof MgtTxType)[keyof typeof MgtTxType];

export const WalletTxType = {
  USDC_DEPOSIT: 'usdc_deposit',
  USDC_WITHDRAW: 'usdc_withdraw',
  USDT_WITHDRAW: 'usdt_withdraw',
  MINING_CLAIM: 'mining_claim',
} as const;

export type WalletTxTypeName = (typeof WalletTxType)[keyof typeof WalletTxType];
