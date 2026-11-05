import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SeasonEditor } from '../../src/components/admin/pass/SeasonEditor';
import { passSeasonCreateSchema } from '@mll/shared';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/lib/api/adminClient', () => ({ adminClient: api }));
const catalog = [
  { id: '10000000-0000-4000-8000-000000000001', rewardType: 'catalog_item', name: 'Atacante lendário', imageUrl: '/card.webp', description: 'Lendário · Atacante · Almoxarifado' },
  { id: '10000000-0000-4000-8000-000000000002', rewardType: 'gear', name: 'Chuteira épica', imageUrl: '/gear.webp', description: 'Épico · Mochila' },
  { id: '10000000-0000-4000-8000-000000000003', rewardType: 'shop_item', name: 'stamina01', imageUrl: '/stamina.webp', description: 'Recuperação total · Almoxarifado' },
];
function editor() { return render(<SeasonEditor season={null} seasons={[]} onCancel={vi.fn()} onSaved={vi.fn()} />); }
async function choose(type: string, name: string) {
  fireEvent.change(screen.getByLabelText('Tipo de prêmio'), { target: { value: type } });
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
}
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); api.get.mockResolvedValue({ data: { items: catalog } }); api.post.mockResolvedValue({ data: {} }); });

describe('Pass catalog editor', () => {
  it('opens on rewards, searches real catalog items and saves selected identity and quantity', async () => {
    editor();
    expect(screen.getByText('Prêmio do nível 1')).toBeTruthy();
    expect(within(screen.getByLabelText('Tipo de prêmio')).queryByRole('option', { name: /aleatório/ })).toBeNull();
    await screen.findByRole('button', { name: /Atacante lendário/ });
    fireEvent.change(screen.getByLabelText('Buscar prêmio no catálogo'), { target: { value: 'não existe' } });
    expect(screen.queryByRole('button', { name: /Atacante lendário/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Buscar prêmio no catálogo'), { target: { value: 'Lendário' } });
    fireEvent.click(screen.getByRole('button', { name: /Atacante lendário/ }));
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '3' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Criar temporada' })[0]);
    await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
    const payload = api.post.mock.calls[0][1];
    expect(payload.active).toBe(false);
    expect(payload.levels[0]).toMatchObject({ rewardType: 'catalog_item', rewardItemId: catalog[0].id, quantity: 3, rewardLabel: '3× Atacante lendário' });
    expect(passSeasonCreateSchema.safeParse(payload).success).toBe(true);
  });
  it.each([['gear', 'Chuteira épica', 1], ['shop_item', 'stamina01', 2]])('selects %s with its image and clears old identity', async (type, name, index) => {
    editor(); await choose('catalog_item', 'Atacante lendário'); await choose(type, name);
    fireEvent.click(screen.getAllByRole('button', { name: 'Criar temporada' })[0]);
    await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
    expect(api.post.mock.calls[0][1].levels[0]).toMatchObject({ rewardType: type, rewardItemId: catalog[index].id, rewardImageUrl: catalog[index].imageUrl });
  });
  it('requires an actual selection and retries catalog loading', async () => {
    api.get.mockRejectedValueOnce(new Error('offline')); editor();
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByRole('button', { name: /Atacante lendário/ });
    fireEvent.click(screen.getAllByRole('button', { name: 'Criar temporada' })[0]);
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByText(/Selecione um prêmio do catálogo para cada nível/)).toBeTruthy();
  });
  it('applies the configured range reward to otherwise empty levels', async () => {
    editor(); await screen.findByRole('button', { name: /Atacante lendário/ });
    fireEvent.click(screen.getByRole('button', { name: /Prêmios por faixa/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar faixa' }));
    fireEvent.change(screen.getByLabelText('Até o nível'), { target: { value: 1 } });
    await choose('shop_item', 'stamina01');
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: 2 } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Criar temporada' })[0]);
    await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
    expect(api.post.mock.calls[0][1].levels[0]).toMatchObject({ level: 1, xpRequired: 0, rewardType: 'shop_item', rewardItemId: catalog[2].id, quantity: 2 });
  });
  it('allows clearing a date without crashing and prevents saving invalid dates', () => {
    editor(); fireEvent.click(screen.getByRole('button', { name: /Dados da temporada/ }));
    const inputs = document.querySelectorAll('input[type="datetime-local"]');
    fireEvent.change(inputs[0], { target: { value: '' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Criar temporada' })[0]);
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByText(/Informe datas válidas/)).toBeTruthy();
  });
});
