import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { VestiarioSlotPicker } from '../../../src/components/stadium/VestiarioSlotPicker';
import type { InventoryPlayerDTO } from '@mll/shared';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === 'club:vestiario.pickPlayerTitle' ? 'ESCOLHER JOGADOR' : key,
  }),
}));

function defender(id: string, name: string): InventoryPlayerDTO {
  return {
    id,
    rarity: 'rare',
    overwall: 80,
    position: 'DEF',
    listed: false,
    kind: 'base',
    name,
    stamina: 100,
    staminaMax: 100,
    costBasisUsdc: 0,
  };
}

afterEach(cleanup);

describe('Vestiario slot picker on a phone', () => {
  it('keeps every defender in a list that scrolls above the bottom nav', () => {
    render(
      <VestiarioSlotPicker
        open
        slotLabel="ZAG-3"
        slotRole="DEF"
        players={[
          defender('d1', 'O Lobisomem'),
          defender('d2', 'Zagueiro 2'),
          defender('d3', 'Zagueiro 3'),
          defender('d4', 'Zagueiro 4'),
        ]}
        assignedKeys={new Set()}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('mobile-sheet');
    expect(dialog.parentElement).toBe(document.body);
    const list = dialog.querySelector('.touch-scroll');
    expect(list).toBeTruthy();
    expect(screen.getByRole('button', { name: /O Lobisomem/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Zagueiro 2/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Zagueiro 3/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Zagueiro 4/ })).toBeTruthy();
  });
});
