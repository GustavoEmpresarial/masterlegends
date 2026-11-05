import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/api/publicFetch', () => ({
  fetchPublicJson: mockFetch,
}));

import { TransparencyPage } from '../../../src/app/transparencia/page';

const SECTION = {
  id: 's1',
  title: 'Sobre o MLL',
  body: 'O **MLL** é uma plataforma de futebol.',
  imageUrl: null as string | null,
  order: 0,
  visible: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const STATS = {
  vault: { address: '0xabc', usdcBalance: 100, chainId: 137, usdcToken: null },
  flow: {
    totalDepositedUsdc: 10,
    totalWithdrawnUsdc: 1,
    depositCount: 2,
    withdrawalCount: 1,
    totalReferralCommissionsGmt: 0,
    totalReferralCommissionsUsdc: 0,
    referralCommissionCount: 0,
  },
  allocation: [{ label: 'A', pct: 50, color: '#22c55e' }],
  generatedAt: '2026-07-18T12:00:00.000Z',
};

function mockTransparencyApis(sections: typeof SECTION[]) {
  mockFetch.mockImplementation(async (path: string) => {
    if (path === '/api/transparencia') return { sections };
    if (path === '/api/transparencia/stats') return STATS;
    if (path === '/api/transparencia/financial-records') {
      return { records: [], summary: null };
    }
    throw new Error(`unexpected path ${path}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('TransparencyPage', () => {
  it('mostra skeleton enquanto carrega', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<TransparencyPage />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renderiza seções após carregar', async () => {
    mockTransparencyApis([SECTION]);
    render(<TransparencyPage />);

    await waitFor(() => {
      expect(screen.getByText('Sobre o MLL')).toBeTruthy();
    });
  });

  it('usa fetchPublicJson (não apiClient) — rota pública', async () => {
    mockTransparencyApis([SECTION]);
    render(<TransparencyPage />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/transparencia'));
    expect(mockFetch).toHaveBeenCalledWith('/api/transparencia/stats');
  });

  it('mostra mensagem de erro quando API falha', async () => {
    mockFetch.mockRejectedValue(new Error('Erro de rede'));
    render(<TransparencyPage />);

    await waitFor(() => {
      expect(screen.getByText('Erro de rede')).toBeTruthy();
    });
  });

  it('omite bloco de seções quando a lista vem vazia', async () => {
    mockTransparencyApis([]);
    render(<TransparencyPage />);

    await waitFor(() => {
      expect(screen.getByText('Portal de Transparência')).toBeTruthy();
    });
    expect(screen.queryByText('Relatórios & Comunicados')).toBeNull();
    expect(screen.queryByText(/nenhuma seção publicada/i)).toBeNull();
  });

  it('renderiza imagem quando imageUrl está presente', async () => {
    const sectionWithImage = { ...SECTION, imageUrl: 'https://example.com/img.png' };
    mockTransparencyApis([sectionWithImage]);
    render(<TransparencyPage />);

    await waitFor(() => {
      const img = document.querySelector('img') as HTMLImageElement;
      expect(img).toBeTruthy();
      expect(img.src).toContain('example.com/img.png');
    });
  });

  it('não renderiza imagem quando imageUrl é null', async () => {
    mockTransparencyApis([SECTION]);
    render(<TransparencyPage />);

    await waitFor(() => {
      expect(screen.getByText('Sobre o MLL')).toBeTruthy();
    });
    expect(document.querySelector('img')).toBeNull();
  });

  it('sobrevive quando stats falha (vault opcional)', async () => {
    mockFetch.mockImplementation(async (path: string) => {
      if (path === '/api/transparencia') return { sections: [SECTION] };
      if (path === '/api/transparencia/stats') throw new Error('stats down');
      if (path === '/api/transparencia/financial-records') throw new Error('fin down');
      throw new Error(path);
    });
    render(<TransparencyPage />);
    await waitFor(() => {
      expect(screen.getByText('Sobre o MLL')).toBeTruthy();
    });
  });
});
