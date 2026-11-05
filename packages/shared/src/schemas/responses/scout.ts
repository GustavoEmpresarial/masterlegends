import type { PlayerAttributes } from '../../economy/attributes.js';

export interface ScoutPlayerDTO {
  id: string;
  rarity: string;
  overwall: number;
  position: string;
  name?: string | null;
  imageUrl?: string | null;
  /** Career age when known (mint = 18). */
  age?: number;
  costBasisUsdc?: number;
  /** Rolled inside the rarity band. Present on a fresh mint. */
  attributes?: PlayerAttributes;
}

export interface ScoutMintResponse {
  players: ScoutPlayerDTO[];
  cost: number;
}
