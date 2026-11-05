import { describe, expect, it } from 'vitest';
import { MARKET_STOCK_CARDS, marketStockQuantity, marketStockTotal } from '../src/economy/market-stock.js';

describe('estoque inicial do marketplace', () => {
  it('mantém a proporção 1:2:2:3:3 e cai cinco vezes por raridade', () => {
    expect(marketStockQuantity('common')).toBe(13750);
    expect(marketStockQuantity('common', 'GK')).toBe(1250);
    expect(marketStockQuantity('common', 'LAT')).toBe(2500);
    expect(marketStockQuantity('common', 'DEF')).toBe(2500);
    expect(marketStockQuantity('common', 'MID')).toBe(3750);
    expect(marketStockQuantity('common', 'FW')).toBe(3750);

    expect(marketStockQuantity('rare')).toBe(2750);
    expect(marketStockQuantity('rare', 'GK')).toBe(250);
    expect(marketStockQuantity('super-rare')).toBe(550);
    expect(marketStockQuantity('super-rare', 'GK')).toBe(50);
    expect(marketStockQuantity('epic')).toBe(110);
    expect(marketStockQuantity('epic', 'GK')).toBe(10);
    expect(marketStockQuantity('legendary')).toBe(22);
    expect(marketStockQuantity('legendary', 'GK')).toBe(2);
    expect(marketStockQuantity('legendary', 'FW')).toBe(6);
    expect(marketStockTotal()).toBe(17182);
  });

  it('usa somente as artes oficiais do servidor de desenvolvimento', () => {
    const urls = new Set(MARKET_STOCK_CARDS.map((card) => card.imageUrl));
    expect([...urls].every((url) => url.startsWith('/uploads/items/'))).toBe(true);
    expect(urls.has('/uploads/items/card-common-01-v2.jpg')).toBe(true);
    expect(urls.has('/uploads/items/mll-nft-01-reydo-lendario.png')).toBe(true);
    expect(MARKET_STOCK_CARDS).toHaveLength(25);
  });

  it('vende cada raridade pelo custo da tabela', () => {
    const price = { common: 0.25, rare: 6.35, 'super-rare': 31.25, epic: 156.25, legendary: 750 };
    for (const card of MARKET_STOCK_CARDS) {
      expect(card.priceGmt).toBe(price[card.rarity]);
    }
  });
});
