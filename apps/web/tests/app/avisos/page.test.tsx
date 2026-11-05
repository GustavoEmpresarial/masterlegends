import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/api/publicFetch', () => ({
  fetchPublicJson: mockFetch,
}));

// react-i18next stub
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k,
  }),
}));

import { AvisosPage } from '../../../src/app/avisos/page';

const NOTICE = {
  id: 'n1',
  title: 'Manutenção programada',
  body: 'Sistema ficará offline das 02h às 04h.',
  category: 'manutencao',
  priority: 'high',
  imageUrl: null,
  active: true,
  startsAt: null,
  endsAt: null,
  createdBy: 'admin',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('AvisosPage', () => {
  it('mostra skeleton enquanto carrega', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<AvisosPage />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renderiza avisos após carregar', async () => {
    mockFetch.mockResolvedValue({ notices: [NOTICE] });
    render(<AvisosPage />);

    await waitFor(() => {
      expect(screen.getByText('Manutenção programada')).toBeTruthy();
    });
  });

  it('usa fetchPublicJson (não apiClient) — rota pública', async () => {
    mockFetch.mockResolvedValue({ notices: [NOTICE] });
    render(<AvisosPage />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/notices'));
  });

  it('mostra estado vazio quando não há avisos', async () => {
    mockFetch.mockResolvedValue({ notices: [] });
    render(<AvisosPage />);

    await waitFor(() => {
      expect(screen.getByText(/nenhum aviso/i)).toBeTruthy();
    });
  });

  it('mostra mensagem de erro quando API falha', async () => {
    mockFetch.mockRejectedValue(new Error('Falha na conexão'));
    render(<AvisosPage />);

    await waitFor(() => {
      expect(screen.getByText('Falha na conexão')).toBeTruthy();
    });
  });

  it('filtra por categoria e passa query string', async () => {
    mockFetch.mockResolvedValue({ notices: [NOTICE] });
    render(<AvisosPage />);

    await waitFor(() => screen.getByText('Manutenção programada'));

    // Clica no filtro de manutenção
    const filterBtn = screen.getByRole('tab', { name: /manuten/i });
    fireEvent.click(filterBtn);

    await waitFor(() => {
      const calls = mockFetch.mock.calls.map((c) => c[0] as string);
      expect(calls.some((u) => u.includes('category=manutencao'))).toBe(true);
    });
  });

  it('cancela fetch ao desmontar', async () => {
    let resolve!: (v: unknown) => void;
    mockFetch.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { unmount } = render(<AvisosPage />);
    unmount();
    resolve({ notices: [NOTICE] });
    await new Promise((r) => setTimeout(r, 10));
  });
});
