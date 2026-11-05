import { mintGmtForRarityIndex } from './scout.js';

/** Conta da liga que vende o estoque inicial. Não é um jogador. */
export const OFFICIAL_MARKET_SELLER_ID = 'a1000000-0000-4000-8000-0000000000aa';

export const OFFICIAL_MARKET_SELLER_NAME = 'Liga';

/**
 * Posição no mesmo índice de `POSITION_NAMES` da API:
 * 0 GK, 1 DEF, 2 MID, 3 FW, 4 LAT.
 */
const POSITION_INDEX = {
  GK: 0,
  DEF: 1,
  MID: 2,
  FW: 3,
  LAT: 4,
} as const;

export type MarketStockPosition = keyof typeof POSITION_INDEX;

const RARITY_INDEX = {
  common: 0,
  rare: 2,
  'super-rare': 3,
  epic: 4,
  legendary: 5,
} as const;

export type MarketStockRarity = keyof typeof RARITY_INDEX;

export interface MarketStockCard {
  id: string;
  templateId: string;
  rarity: MarketStockRarity;
  rarityIndex: number;
  position: MarketStockPosition;
  positionIndex: number;
  quantity: number;
  name: string;
  /** Caminho público. O arquivo é a cópia byte a byte do servidor de desenvolvimento. */
  imageUrl: string;
  overwall: number;
  priceGmt: number;
}

function card(
  n: number,
  rarity: MarketStockRarity,
  position: MarketStockPosition,
  quantity: number,
  name: string,
  imageUrl: string,
  overwall: number,
): MarketStockCard {
  const suffix = String(n).padStart(12, '0');
  const rarityIndex = RARITY_INDEX[rarity];
  return {
    id: `a1000001-0000-4000-8000-${suffix}`,
    templateId: `b1000001-0000-4000-8000-${suffix}`,
    rarity,
    rarityIndex,
    position,
    positionIndex: POSITION_INDEX[position],
    quantity,
    name,
    imageUrl,
    overwall,
    priceGmt: mintGmtForRarityIndex(rarityIndex),
  };
}

/**
 * Estoque inicial da liga.
 * Cada raridade vale 1/5 da anterior. A proporção entre posições fica 1:2:2:3:3
 * (goleiro, lateral, zagueiro, meio, ataque).
 * A arte aponta para os arquivos oficiais do servidor de desenvolvimento.
 * Posição sem retrato próprio reutiliza outro arquivo oficial da mesma raridade.
 */
export const MARKET_STOCK_CARDS: readonly MarketStockCard[] = [
  card(1, 'common', 'GK', 1250, 'Radar', '/uploads/items/card-common-01-v2.jpg', 3),
  card(2, 'common', 'LAT', 2500, 'Nuno', '/uploads/items/card-common-02-v2.jpg', 2),
  card(3, 'common', 'DEF', 2500, 'Nuno', '/uploads/items/card-common-02-v2.jpg', 2),
  card(4, 'common', 'MID', 3750, 'Caio', '/uploads/items/card-common-03-v2.jpg', 9),
  card(5, 'common', 'FW', 3750, 'Caio', '/uploads/items/card-common-03-v2.jpg', 9),

  card(6, 'rare', 'GK', 250, 'Teo', '/uploads/items/card-rare-02-v2.jpg', 7),
  card(7, 'rare', 'LAT', 500, 'Bruno', '/uploads/items/card-rare-03-v2.jpg', 18),
  card(8, 'rare', 'DEF', 500, 'Bruno', '/uploads/items/card-rare-03-v2.jpg', 18),
  card(9, 'rare', 'MID', 750, 'Vini', '/uploads/items/card-rare-01-v2.jpg', 11),
  card(10, 'rare', 'FW', 750, 'Vini', '/uploads/items/card-rare-01-v2.jpg', 11),

  card(11, 'super-rare', 'GK', 50, 'Igor', '/uploads/items/card-super-rare-03-v2.jpg', 119),
  card(12, 'super-rare', 'LAT', 100, 'Luan', '/uploads/items/card-super-rare-01-v2.jpg', 98),
  card(13, 'super-rare', 'DEF', 100, 'Luan', '/uploads/items/card-super-rare-01-v2.jpg', 98),
  card(14, 'super-rare', 'MID', 150, 'Luan', '/uploads/items/card-super-rare-01-v2.jpg', 98),
  card(15, 'super-rare', 'FW', 150, 'Dani', '/uploads/items/card-super-rare-02-v2.jpg', 92),

  card(16, 'epic', 'GK', 10, 'Otto', '/uploads/items/card-epic-02-v2.jpg', 506),
  card(17, 'epic', 'LAT', 20, 'Rafa', '/uploads/items/card-epic-03-v2.jpg', 547),
  card(18, 'epic', 'DEF', 20, 'Nayo', '/uploads/items/mll-nft-08-nayo-epico.png', 610),
  card(19, 'epic', 'MID', 30, 'Otto', '/uploads/items/card-epic-02-v2.jpg', 506),
  card(20, 'epic', 'FW', 30, 'Rafa', '/uploads/items/card-epic-03-v2.jpg', 547),

  card(21, 'legendary', 'GK', 2, 'Roge', '/uploads/items/mll-nft-09-roge-lendario.png', 2244),
  card(22, 'legendary', 'LAT', 4, 'Rondi', '/uploads/items/mll-nft-03-rondi-lendario.png', 2259),
  card(23, 'legendary', 'DEF', 4, 'Dago', '/uploads/items/mll-nft-04-dago-lendario.png', 2377),
  card(24, 'legendary', 'MID', 6, 'Zino', '/uploads/items/mll-nft-07-zino-lendario.png', 1430),
  card(25, 'legendary', 'FW', 6, 'Reydo', '/uploads/items/mll-nft-01-reydo-lendario.png', 1378),
];

export function marketStockQuantity(
  rarity: MarketStockRarity,
  position?: MarketStockPosition,
): number {
  return MARKET_STOCK_CARDS.filter(
    (row) => row.rarity === rarity && (position === undefined || row.position === position),
  ).reduce((sum, row) => sum + row.quantity, 0);
}

export function marketStockTotal(): number {
  return MARKET_STOCK_CARDS.reduce((sum, row) => sum + row.quantity, 0);
}
