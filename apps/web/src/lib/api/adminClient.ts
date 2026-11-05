import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getAdminAccessToken, setAdminAccessToken, clearAdminAccessToken } from '../auth/adminStorage';
import { isFatalAuthError, isTransientError } from '../auth/refresh';
import { reportApiError } from '../telemetry/reportClientError';
import { resolveAdminApiUrl } from './baseUrl';

const baseURL = resolveAdminApiUrl();

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _csrfRetry?: boolean;
}

export const adminClient: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});

let csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  const { data } = await axios.get<{ csrfToken: string }>(`${baseURL}/csrf`, {
    withCredentials: true,
  });
  csrfToken = data.csrfToken;
  return csrfToken;
}

const CSRF_ROUTES = ['/refresh', '/logout'];

/** Public admin auth endpoints — 401 must not trigger access-token refresh. */
const AUTH_PUBLIC_PATHS = ['/login', '/refresh', '/csrf', '/verify-2fa', '/logout'];

function shouldRefreshOn401(url: string | undefined): boolean {
  if (!url) return false;
  return !AUTH_PUBLIC_PATHS.some((path) => url.includes(path));
}

function requiresCsrf(url: string | undefined): boolean {
  if (!url) return false;
  return CSRF_ROUTES.some((r) => url.includes(r));
}

function shouldForceAdminLogout(error: unknown): boolean {
  if (isTransientError(error)) return false;
  if (!isFatalAuthError(error)) return false;
  return true;
}

adminClient.interceptors.request.use(async (requestConfig) => {
  // Strip broken multipart header (axios manual "multipart/form-data" without boundary → empty body → 400)
  const headers = requestConfig.headers ?? {};
  const contentType = headers['Content-Type'] ?? headers['content-type'];
  if (
    typeof contentType === 'string' &&
    /^multipart\/form-data\s*$/i.test(contentType.trim())
  ) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }

  const token = getAdminAccessToken();
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  if (requiresCsrf(requestConfig.url)) {
    if (!csrfToken) {
      try {
        await fetchCsrfToken();
      } catch {
        /* server will reject */
      }
    }
    if (csrfToken) {
      requestConfig.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return requestConfig;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAdminToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      csrfToken = null;
      await fetchCsrfToken();
      const res = await adminClient.post<{ accessToken: string }>('/refresh', {});
      const next = res.data.accessToken;
      setAdminAccessToken(next);
      return next;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

adminClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableRequest | undefined;
    const status = error.response?.status;
    const code = (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code;

    if (status === 403 && code === 'AUTH_CSRF_INVALID' && original && !original._csrfRetry) {
      original._csrfRetry = true;
      csrfToken = null;
      try {
        await fetchCsrfToken();
        if (requiresCsrf(original.url) && csrfToken) {
          original.headers = original.headers ?? {};
          original.headers['X-CSRF-Token'] = csrfToken;
        }
        return adminClient(original);
      } catch {
        /* fall through */
      }
    }

    if (status === 401 && original && !original._retry && shouldRefreshOn401(original.url)) {
      original._retry = true;
      try {
        const token = await refreshAdminToken();
        if (original.headers) {
          original.headers.Authorization = `Bearer ${token}`;
        }
        return adminClient(original);
      } catch (refreshError) {
        if (shouldForceAdminLogout(refreshError)) {
          clearAdminAccessToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/admin/login';
          }
        }
      }
    }

    if (status && status >= 400 && original && !original.url?.includes('/telemetry/failures')) {
      reportApiError(error, original.url, original.method);
    }

    return Promise.reject(error);
  },
);

export async function primeAdminCsrf(): Promise<void> {
  try {
    await fetchCsrfToken();
  } catch {
    /* optional */
  }
}
