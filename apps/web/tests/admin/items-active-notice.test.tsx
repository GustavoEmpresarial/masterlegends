import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminItemsPage } from '../../src/app/admin/items/page';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('../../src/lib/api/adminClient', () => ({ adminClient: api }));

const activeItem = {
  id: 'item-1',
  name: 'Cai Bale',
  imageUrl: '/uploads/items/cai.png',
  rarity: 1,
  position: 0,
  overwall: 1200,
  weight: 1,
  active: true,
  createdBy: 'admin',
  createdAt: '2026-11-09T00:00:00.000Z',
  updatedAt: '2026-11-09T00:00:00.000Z',
};

afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue({ data: { items: [activeItem] } });
  api.post.mockResolvedValue({ data: {} });
  api.patch.mockResolvedValue({ data: {} });
});

describe('Admin item active notice', () => {
  it('warns before deactivating and only then removes the player from the market', async () => {
    render(<AdminItemsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ativo' }));

    expect(screen.getByRole('dialog').textContent).toMatch(/sai na hora do mercado, da lojinha e do olheiro/);
    expect(screen.getByRole('dialog').textContent).toMatch(/não voltam sozinhas para a venda/);
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ativo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/items/item-1/active', { active: false }));
  });

  it('warns that reactivation does not put player copies back on sale', async () => {
    api.get.mockResolvedValue({ data: { items: [{ ...activeItem, active: false }] } });
    render(<AdminItemsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Inativo' }));

    expect(screen.getByRole('dialog').textContent).toMatch(/estoque oficial/);
    expect(screen.getByRole('dialog').textContent).toMatch(/Cada dono precisa anunciar de novo/);
    fireEvent.click(screen.getByRole('button', { name: 'Reativar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/items/item-1/active', { active: true }));
  });

  it('warns again when the edit form changes the active flag', async () => {
    const view = render(<AdminItemsPage />);
    await screen.findByRole('button', { name: 'Ativo' });
    const pencil = view.container.querySelector('.bi-pencil');
    expect(pencil).toBeTruthy();
    fireEvent.click(pencil!.closest('button')!);

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Atualizar item/ }));
    expect(api.patch).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').textContent).toMatch(/Desativar Cai Bale/);

    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/items/item-1', expect.objectContaining({ active: false })));
  });
});
