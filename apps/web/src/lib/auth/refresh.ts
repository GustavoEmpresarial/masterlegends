import { AxiosError } from 'axios';
import { ErrorCode } from '@mll/shared';
import { extractErrorCode } from '../apiError';

const FATAL_REFRESH_CODES = new Set<string>([
  ErrorCode.AUTH_NO_REFRESH_TOKEN,
  ErrorCode.AUTH_INVALID_REFRESH_TOKEN,
  ErrorCode.AUTH_REFRESH_REUSED,
  ErrorCode.AUTH_INVALID_TOKEN_TYPE,
]);

export function isTransientError(error: unknown): boolean {
  const code = extractErrorCode(error);
  if (code === 'ERR_NETWORK') return true;
  if (code === ErrorCode.AUTH_CSRF_INVALID) return true;
  const axiosErr = error as AxiosError | undefined;
  const status = axiosErr?.response?.status;
  if (status === 502 || status === 503 || status === 504) return true;
  if (!axiosErr?.response && axiosErr?.code !== undefined) return true;
  return false;
}

export function isFatalAuthError(error: unknown): boolean {
  const code = extractErrorCode(error);
  return FATAL_REFRESH_CODES.has(code);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function refreshWithRetry(
  refreshFn: () => Promise<string>,
  options?: { maxAttempts?: number; baseDelayMs?: number },
): Promise<string> {
  const maxAttempts = options?.maxAttempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 750;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await refreshFn();
    } catch (error) {
      lastError = error;
      if (isFatalAuthError(error)) {
        throw error;
      }
      if (!isTransientError(error)) {
        throw error;
      }
      if (attempt < maxAttempts - 1) {
        await sleep(baseDelayMs * (attempt + 1));
      }
    }
  }
  throw lastError;
}
