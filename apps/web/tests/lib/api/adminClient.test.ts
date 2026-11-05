import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

const mocks = vi.hoisted(() => {
  const instance = Object.assign(vi.fn().mockResolvedValue({ data: { ok: true } }), {
    defaults: { withCredentials: true, headers: {} as Record<string, string> },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
  });
  return {
    instance,
    axiosGet: vi.fn(),
    axiosCreate: vi.fn(() => instance),
    getAdminAccessToken: vi.fn(() => 'admin-token-a'),
    setAdminAccessToken: vi.fn(),
    clearAdminAccessToken: vi.fn(),
  };
});

vi.mock('axios', () => ({
  default: {
    create: mocks.axiosCreate,
    get: mocks.axiosGet,
  },
}));

vi.mock('../../../src/lib/auth/adminStorage', () => ({
  getAdminAccessToken: mocks.getAdminAccessToken,
  setAdminAccessToken: mocks.setAdminAccessToken,
  clearAdminAccessToken: mocks.clearAdminAccessToken,
}));

vi.mock('../../../src/lib/telemetry/reportClientError', () => ({
  reportApiError: vi.fn(),
}));

const { adminClient, primeAdminCsrf } = await import('../../../src/lib/api/adminClient');

const requestHandler = mocks.instance.interceptors.request.use.mock.calls[0][0] as (
  cfg: InternalAxiosRequestConfig,
) => Promise<InternalAxiosRequestConfig>;

const responseHandler = mocks.instance.interceptors.response.use.mock.calls[0][1] as (
  error: AxiosError,
) => Promise<unknown>;

describe('adminClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminAccessToken.mockReturnValue('admin-token-a');
    mocks.axiosGet.mockResolvedValue({ data: { csrfToken: 'csrf-x' } });
  });

  it('exposes configured client', () => {
    expect(adminClient.defaults.withCredentials).toBe(true);
  });

  it('injects bearer token on requests', async () => {
    const cfg = { headers: {} } as InternalAxiosRequestConfig;
    const out = await requestHandler(cfg);
    expect(out.headers?.Authorization).toBe('Bearer admin-token-a');
  });

  it('does not refresh on 401 for /refresh (no deadlock)', async () => {
    const original = { url: '/refresh', headers: {}, _retry: false } as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const error = {
      response: { status: 401, data: { error: { code: 'AUTH_NO_REFRESH_TOKEN' } } },
      config: original,
    } as AxiosError;

    await expect(responseHandler(error)).rejects.toBe(error);
    expect(
      mocks.instance.post.mock.calls.filter((c) => String(c[0]).includes('/refresh')),
    ).toHaveLength(0);
  });

  it('does not refresh on 401 for /login', async () => {
    const original = { url: '/login', headers: {}, _retry: false } as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const error = {
      response: { status: 401 },
      config: original,
    } as AxiosError;

    await expect(responseHandler(error)).rejects.toBe(error);
    expect(
      mocks.instance.post.mock.calls.filter((c) => String(c[0]).includes('/refresh')),
    ).toHaveLength(0);
  });

  it('refreshes admin token on 401 for protected routes', async () => {
    mocks.instance.post.mockResolvedValueOnce({ data: { accessToken: 'admin-refreshed' } });
    mocks.instance.mockResolvedValue({ data: { ok: true } });
    const original = { url: '/me', headers: {}, _retry: false } as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const error = {
      response: { status: 401 },
      config: original,
    } as AxiosError;

    await expect(responseHandler(error)).resolves.toBeDefined();
    expect(mocks.setAdminAccessToken).toHaveBeenCalledWith('admin-refreshed');
  });

  it('rejects when refresh fails fatally without extra refresh attempts', async () => {
    mocks.instance.post.mockRejectedValueOnce({
      response: { status: 401, data: { error: { code: 'AUTH_NO_REFRESH_TOKEN' } } },
    });
    const original = { url: '/me', headers: {}, _retry: false } as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const error = {
      response: { status: 401 },
      config: original,
    } as AxiosError;

    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      href: '',
    } as Location);

    await expect(responseHandler(error)).rejects.toBeDefined();
    expect(mocks.clearAdminAccessToken).toHaveBeenCalled();

    locationSpy.mockRestore();
  });

  it('does not force logout on transient refresh failure', async () => {
    mocks.instance.post.mockRejectedValueOnce({
      response: { status: 503 },
      code: 'ERR_BAD_RESPONSE',
    });
    const original = { url: '/me', headers: {}, _retry: false } as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const error = {
      response: { status: 401 },
      config: original,
    } as AxiosError;

    await expect(responseHandler(error)).rejects.toBe(error);
    expect(mocks.clearAdminAccessToken).not.toHaveBeenCalled();
  });

  it('primes admin csrf token', async () => {
    mocks.axiosGet.mockResolvedValueOnce({ data: { csrfToken: 'admin-csrf' } });
    await primeAdminCsrf();
    expect(mocks.axiosGet).toHaveBeenCalled();
  });
});
