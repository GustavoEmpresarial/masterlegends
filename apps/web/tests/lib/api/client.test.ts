import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

const mocks = vi.hoisted(() => {
  const instance = Object.assign(vi.fn().mockResolvedValue({ data: { ok: true } }), {
    defaults: { withCredentials: true, headers: {} as Record<string, string> },
    interceptors: {
      request: { use: vi.fn(),
      },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
  });
  return {
    instance,
    axiosGet: vi.fn(),
    axiosCreate: vi.fn(() => instance),
    getAccessToken: vi.fn(() => 'token-a'),
    setAccessToken: vi.fn(),
    clearAccessToken: vi.fn(),
  };
});

vi.mock('axios', () => ({
  default: {
    create: mocks.axiosCreate,
    get: mocks.axiosGet,
  },
}));

vi.mock('../../../src/lib/auth/storage', () => ({
  getAccessToken: mocks.getAccessToken,
  setAccessToken: mocks.setAccessToken,
  clearAccessToken: mocks.clearAccessToken,
}));

vi.mock('../../../src/lib/telemetry/reportClientError', () => ({
  reportApiError: vi.fn(),
}));

const { apiClient, primeCsrf, LOGOUT_EVENT } = await import('../../../src/lib/api/client');

const requestHandler = mocks.instance.interceptors.request.use.mock.calls[0][0] as (
  cfg: InternalAxiosRequestConfig,
) => Promise<InternalAxiosRequestConfig>;

const responseHandler = mocks.instance.interceptors.response.use.mock.calls[0][1] as (
  error: AxiosError,
) => Promise<unknown>;

function refreshPosts() {
  return mocks.instance.post.mock.calls.filter(
    (c) => typeof c[0] === 'string' && String(c[0]).includes('/auth/refresh'),
  );
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccessToken.mockReturnValue('token-a');
    mocks.instance.mockResolvedValue({ data: { ok: true } });
  });

  it('exposes configured client', () => {
    expect(apiClient.defaults.withCredentials).toBe(true);
    expect(LOGOUT_EVENT).toBe('mll:logout');
  });

  it('injects bearer token on requests', async () => {
    const cfg = { headers: {} as Record<string, string> } as InternalAxiosRequestConfig;
    const out = await requestHandler(cfg);
    const auth =
      (out.headers as Record<string, string> | undefined)?.Authorization ??
      (out.headers as Record<string, string> | undefined)?.authorization;
    expect(auth).toBe('Bearer token-a');
  });

  it('fetches csrf for cookie routes', async () => {
    mocks.axiosGet.mockResolvedValueOnce({ data: { csrfToken: 'csrf-1' } });
    const cfg = { url: '/auth/refresh', headers: {} } as InternalAxiosRequestConfig;
    const out = await requestHandler(cfg);
    expect(out.headers?.['X-CSRF-Token']).toBe('csrf-1');
  });

  it('retries once after csrf invalid', async () => {
    mocks.axiosGet.mockResolvedValue({ data: { csrfToken: 'csrf-2' } });
    const original = { url: '/club', headers: {}, _csrfRetry: false } as InternalAxiosRequestConfig & {
      _csrfRetry?: boolean;
    };
    const error = {
      response: { status: 403, data: { error: { code: 'AUTH_CSRF_INVALID' } } },
      config: original,
    } as AxiosError;

    await expect(responseHandler(error)).resolves.toBeDefined();
    expect(original._csrfRetry).toBe(true);
  });

  it('refreshes access token on 401', async () => {
    mocks.instance.post
      .mockResolvedValueOnce({ data: { accessToken: 'refreshed' } })
      .mockResolvedValue({ data: { ok: true } });
    mocks.instance.mockResolvedValue({ data: { ok: true } });
    const original = { url: '/api/club', headers: {}, _retry: false } as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const error = {
      response: { status: 401 },
      config: original,
    } as AxiosError;

    await expect(responseHandler(error)).resolves.toBeDefined();
    expect(mocks.setAccessToken).toHaveBeenCalledWith('refreshed');
  });

  it('refreshes access token on 401 for authenticated wallet API routes', async () => {
    mocks.instance.post
      .mockResolvedValueOnce({ data: { accessToken: 'refreshed' } })
      .mockResolvedValue({ data: { ok: true } });
    mocks.instance.mockResolvedValue({ data: { ok: true } });
    const original = { url: '/api/wallet/summary', headers: {}, _retry: false } as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const error = {
      response: { status: 401 },
      config: original,
    } as AxiosError;

    await expect(responseHandler(error)).resolves.toBeDefined();
    expect(mocks.setAccessToken).toHaveBeenCalledWith('refreshed');
  });

  it('does not refresh on 401 for login', async () => {
    const original = { url: '/auth/login', headers: {}, _retry: false } as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const error = {
      response: { status: 401 },
      config: original,
    } as AxiosError;

    await expect(responseHandler(error)).rejects.toBe(error);
    expect(refreshPosts()).toHaveLength(0);
  });

  it('clears session when refresh fails fatally', async () => {
    mocks.instance.post.mockRejectedValueOnce({
      response: { status: 401, data: { error: { code: 'AUTH_NO_REFRESH_TOKEN' } } },
    });
    const original = { url: '/api/club', headers: {}, _retry: false } as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const error = {
      response: { status: 401 },
      config: original,
    } as AxiosError;

    await expect(responseHandler(error)).rejects.toBeDefined();
    expect(mocks.clearAccessToken).toHaveBeenCalled();
  });

  it('primes csrf token', async () => {
    mocks.axiosGet.mockResolvedValueOnce({ data: { csrfToken: 'csrf-prime' } });
    await primeCsrf();
    expect(mocks.axiosGet).toHaveBeenCalled();
  });
});
