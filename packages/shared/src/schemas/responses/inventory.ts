import type { PlayerAttributes } from '../../economy/attributes.js';
import type { FreeFieldWindowDTO } from '../../economy/free-field.js';

export interface InventoryEquippedGearDTO {
  slot: string;
  userGearId: string;
  nameKey: string;
  rarity: number;
  owBonus: number;
  imageUrl: string | null;
}

export interface InventoryPlayerDTO {
  id: string;
  rarity: string;
  overwall: number;
  /** Power in the player's position. Shown as the locker-room level. */
  positionPower?: number;
  /** Base overwall + equipped gear bonuses. */
  effectiveOverwall?: number;
  equippedGear?: InventoryEquippedGearDTO[];
  position: string;
  listed: boolean;
  inLineup?: boolean;
  kind: 'base' | 'nft';
  tokenId?: string;
  name?: string | null;
  imageUrl?: string | null;
  stamina?: number;
  staminaMax?: number;
  createdAt?: string;
  source?: string;
  fieldedAt?: string | null;
  expiresAt?: string | null;
  /** Acquisition cost (USDC-eq). 0 = no ROI career. */
  costBasisUsdc?: number;
  /** Mining USDC attributed while on XI. */
  lifetimeEarnedUsdc?: number;
  /** Career age 18–40 from ROI. */
  age?: number;
  retireAge?: number;
  /** ROI percent vs cost (200 = retire). */
  roiPct?: number;
  retiredAt?: string | null;
  /** True when GMT is locked on this player for fielding. */
  staked?: boolean;
  /** GMT required / currently locked for this rarity. */
  stakeGmt?: number;
  /** When the active stake started. Early exit burns 30%, minus 1% per full day. */
  stakedAt?: string | null;
  /** Unstaked pitch window: 5 minutes, then locked until 24 hours from the start. */
  freeField?: FreeFieldWindowDTO;
  /** Rolled stats. The card art prints four of them: forca, velocidade, resistencia, tecnica. */
  attributes?: PlayerAttributes;
}

export interface InventoryResponse {
  players: InventoryPlayerDTO[];
  totalPlayers: number;
}
