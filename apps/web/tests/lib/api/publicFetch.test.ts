import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResolveApiUrl = vi.hoisted(() => vi.fn(() => ''));
vi.mock('../../../src/lib/api/baseUrl', () => ({
  resolveApiUrl: mockResolveApiUrl,
}));

const { fetchPublicJson } = await import('../../../src/lib/api/publicFetch');

beforeEach(() => {
  vi.restoreAllMocks();
  mockResolveApiUrl.mockReturnValue('');
});

describe('fetchPublicJson', () => {
  it('faz GET e retorna JSON parseado', async () => {
    const payload = { sections: [{ id: '1', title: 'test' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    }));

    const result = await fetchPublicJson('/transparencia');
    expect(result).toEqual(payload);
    expect(fetch).toHaveBeenCalledWith('/transparencia');
  });

  it('prefixa a URL com base quando VITE_API_URL está definida', async () => {
    mockResolveApiUrl.mockReturnValue('https://api.example.com');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));

    await fetchPublicJson('/notices');

    expect(fetch).toHaveBeenCalledWith('https://api.example.com/notices');
  });

  it('lança erro quando response não é ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    await expect(fetchPublicJson('/transparencia')).rejects.toThrow('Failed to load /transparencia (500)');
  });

  it('não inclui Authorization header — é uma chamada pública', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));

    await fetchPublicJson('/transparencia');

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toBe('/transparencia');
    // fetch nativo sem init — sem auth headers
    expect(init).toBeUndefined();
  });

  it('propaga erro de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

    await expect(fetchPublicJson('/transparencia')).rejects.toThrow('Network failure');
  });
});
