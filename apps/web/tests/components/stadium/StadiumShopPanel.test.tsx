import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StadiumShopPanel } from '../../../src/components/stadium/StadiumShopPanel';

const buy = vi.hoisted(() => vi.fn());

vi.mock('../../../src/hooks/useApi', () => ({
  useStadiumShop: () => ({
    isLoading: false,
    data: {
      items: [],
      gear: [
        {
          id: 'gear-1',
          slug: 'luvas-rara',
          nameKey: 'gear.glovesRare',
          slot: 'gloves',
          rarity: 2,
          owBonus: 4,
          priceGmt: 0.25,
          imageUrl: null,
          description: null,
          active: true,
          sortOrder: 0,
        },
      ],
    },
  }),
  useClub: () => ({ data: { gmtBalance: 10 } }),
  useBuyGear: () => ({ mutateAsync: buy, isPending: false }),
  useBuyStadiumShopItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../../src/lib/apiError', () => ({ translateError: () => 'Erro' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { amount?: string; defaultValue?: string }) => {
      if (key === 'club:gear.glovesRare') return 'Luvas Rara';
      if (key === 'club:shop.buyGear') return 'COMPRAR → MOCHILA';
      if (key === 'club:shop.currencyGmt') return 'GMT';
      if (key === 'club:gear.bonus') return 'Bônus';
      if (key === 'spendConfirm.cancel') return 'NÃO QUERO GASTAR';
      if (key === 'spendConfirm.confirm') return `SIM, GASTAR ${opts?.amount ?? ''} GMT`;
      return opts?.defaultValue ?? key;
    },
    i18n: { language: 'pt-BR', resolvedLanguage: 'pt-BR' },
  }),
}));

afterEach(() => {
  cleanup();
  buy.mockReset();
});

describe('Stadium shop purchase confirmation', () => {
  it('does not charge until the player confirms the GMT amount', () => {
    buy.mockResolvedValue({ gmtBalance: 9.75 });
    render(
      <MemoryRouter>
        <StadiumShopPanel />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'COMPRAR → MOCHILA' }));

    expect(buy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'COMPRAR → MOCHILA' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getAllByText('Luvas Rara')).toHaveLength(2);
    expect(screen.getByTestId('spend-amount').textContent).toContain('0,25');

    fireEvent.click(screen.getByRole('button', { name: 'NÃO QUERO GASTAR' }));
    expect(buy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'COMPRAR → MOCHILA' }));
    fireEvent.click(screen.getByTestId('spend-confirm'));
    expect(buy).toHaveBeenCalledWith({ catalogItemId: 'gear-1' });
  });
});
