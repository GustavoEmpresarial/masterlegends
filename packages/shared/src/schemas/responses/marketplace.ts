export interface ListingDTO {
  id: string;
  tokenId: string | null;
  basePlayerId: string | null;
  /** player = carta base, nft = carta on-chain listada no jogo. */
  asset: 'player' | 'nft';
  /** Anúncio ativo. */
  status: 'selling';
  rarity: string;
  overwall: number;
  /** Poder do posto. É o nível do jogador. */
  level: number;
  position: string;
  price: number;
  seller: string;
  name: string | null;
  imageUrl: string | null;
  /** Seller-side career age (resets on buy). */
  age?: number;
  costBasisUsdc?: number;
  lifetimeEarnedUsdc?: number;
  roiPct?: number;
  /** Cópias ainda à venda no estoque oficial da liga. Ausente nos anúncios de jogadores. */
  stock?: number;
}

export interface MarketplaceSearchResponse {
  listings: ListingDTO[];
}
