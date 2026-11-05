import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ErrorCode } from '@mll/shared';
import { getAccessToken, setAccessToken, clearAccessToken } from '../auth/storage';
import { isFatalAuthError, isTransientError, refreshWithRetry } from '../auth/refresh';
import { extractErrorCode } from '../apiError';
import { reportApiError } from '../telemetry/reportClientError';
import { resolveApiUrl } from './baseUrl';

const baseURL = resolveApiUrl();

export const LOGOUT_EVENT = 'mll:logout';
export const MAINTENANCE_EVENT = 'mll:maintenance';

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _csrfRetry?: boolean;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});

let csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  const { data } = await axios.get<{ csrfToken: string }>(`${baseURL}/auth/csrf`, {
    withCredentials: true,
  });
  csrfToken = data.csrfToken;
  return csrfToken;
}

const CSRF_ROUTES = ['/auth/refresh', '/auth/logout'];

/** Public auth endpoints — 401 must not trigger access-token refresh. */
const AUTH_PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/csrf',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/resend-verification-email',
  '/auth/stadium-live/pair',
  '/auth/stadium-live/poll',
];

function shouldRefreshOn401(url: string | undefined): boolean {
  if (!url) return false;
  return !AUTH_PUBLIC_PATHS.some((path) => url.includes(path));
}

function requiresCsrf(url: string | undefined): boolean {
  if (!url) return false;
  return CSRF_ROUTES.some((r) => url.endsWith(r));
}

apiClient.interceptors.request.use(async (requestConfig) => {
  const headers = requestConfig.headers ?? {};
  const contentType = headers['Content-Type'] ?? headers['content-type'];
  if (
    typeof contentType === 'string' &&
    /^multipart\/form-data\s*$/i.test(contentType.trim())
  ) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }

  const token = getAccessToken();
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  if (requiresCsrf(requestConfig.url)) {
    if (!csrfToken) {
      try {
        await fetchCsrfToken();
      } catch {
        /* let server reject */
      }
    }
    if (csrfToken) {
      requestConfig.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return requestConfig;
});

let refreshPromise: Promise<string> | null = null;

async function postRefresh(): Promise<string> {
  const { data } = await apiClient.post<{ accessToken: string }>('/auth/refresh', {});
  return data.accessToken;
}

async function postRefreshWithCsrfRetry(): Promise<string> {
  try {
    return await postRefresh();
  } catch (error) {
    const code = extractErrorCode(error);
    const status = (error as AxiosError)?.response?.status;
    if (code === ErrorCode.AUTH_CSRF_INVALID || status === 403) {
      csrfToken = null;
      await fetchCsrfToken();
      return postRefresh();
    }
    throw error;
  }
}

export async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshWithRetry(postRefreshWithCsrfRetry)
      .then((next) => {
        setAccessToken(next);
        return next;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function shouldForceLogout(error: unknown): boolean {
  if (isTransientError(error)) return false;
  if (!isFatalAuthError(error)) return false;
  return true;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableRequest | undefined;
    const status = error.response?.status;
    const code = (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code;

    if (
      status === 503 &&
      code === ErrorCode.MAINTENANCE_MODE &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/admin')
    ) {
      const details = (error.response?.data as { error?: { details?: { message?: string } } } | undefined)
        ?.error?.details;
      window.dispatchEvent(
        new CustomEvent(MAINTENANCE_EVENT, { detail: { message: details?.message } }),
      );
    }

    if (status === 403 && code === 'AUTH_CSRF_INVALID' && original && !original._csrfRetry) {
      original._csrfRetry = true;
      csrfToken = null;
      try {
        await fetchCsrfToken();
        return apiClient(original);
      } catch {
        /* fall through */
      }
    }

    if (status === 401 && original && !original._retry && shouldRefreshOn401(original.url)) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        if (original.headers) {
          original.headers.Authorization = `Bearer ${token}`;
        }
        return apiClient(original);
      } catch (refreshError) {
        if (shouldForceLogout(refreshError)) {
          clearAccessToken();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event(LOGOUT_EVENT));
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

export async function primeCsrf(): Promise<void> {
  try {
    await fetchCsrfToken();
  } catch {
    /* ignore — will be fetched lazily on first cookie route */
  }
}
