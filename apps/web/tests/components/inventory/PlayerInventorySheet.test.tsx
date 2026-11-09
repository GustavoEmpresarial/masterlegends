import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlayerInventorySheet } from '../../../src/components/inventory/PlayerInventorySheet';
import type { InventoryPlayerDTO, UserGearDTO } from '@mll/shared';

vi.mock('../../../src/hooks/useApi', () => ({
  useGearBag: () => ({
    data: {
      items: [
        {
          id: 'gear-gloves',
          catalogItemId: 'cat-gloves',
          nameKey: 'gear.glovesUncommon',
          slot: 'gloves',
          rarity: 1,
          owBonus: 2,
          imageUrl: null,
          source: 'shop',
          acquiredAt: '2026-11-07T00:00:00.000Z',
          equippedOn: null,
        } satisfies UserGearDTO,
      ],
      total: 1,
    },
    isLoading: false,
  }),
  useEquipGear: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUnequipGear: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../../src/lib/apiError', () => ({ translateError: () => 'Erro' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translate }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));

function translate(key: string, opts?: Record<string, unknown>) {
  if (key === 'club:gear.glovesUncommon') return 'Luvas Incomum';
  if (key === 'club:gear.bonusCompact') return `Bônus: +${opts?.ow ?? ''}`;
  if (key === 'club:gear.tapOrDrop') return 'Toque ou solte';
  if (key === 'club:gear.gloves') return 'Luvas';
  if (key === 'club:gear.boots') return 'Chuteiras';
  if (key === 'club:gear.shinguards') return 'Caneleiras';
  if (key === 'club:gear.powerTarget') return 'Poder do jogador';
  if (key === 'club:gear.bag') return 'Mochila';
  if (key === 'club:gear.oneClickHint') return 'Toque num item para equipar';
  if (key === 'club:gear.filterAll') return 'Tudo';
  if (key === 'club:gear.removeSlot') return 'Remover';
  if (key === 'club:gear.discard') return 'Descartar';
  if (key === 'club:gear.save') return 'Salvar';
  if (key === 'club:gear.sellMarketplace') return 'Vender no Marketplace';
  if (key === 'club:gear.inLoadout') return 'No loadout';
  return key;
}

const player: InventoryPlayerDTO = {
  id: 'player-1',
  rarity: 'uncommon',
  overwall: 70,
  position: 'GK',
  listed: false,
  kind: 'base',
  name: 'Cai Bale',
  stamina: 100,
  staminaMax: 100,
  costBasisUsdc: 0,
};

afterEach(cleanup);

describe('PlayerInventorySheet gear slots', () => {
  it('shows the bonus in the slot when a glove is tapped', () => {
    render(
      <MemoryRouter>
        <PlayerInventorySheet player={player} onClose={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('button', { name: /Toque ou solte/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /Luvas Incomum/ }));

    expect(screen.getAllByRole('button', { name: /Luvas[\s\S]*Bônus: \+2/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Toque ou solte/ })).toHaveLength(2);
  });
});
