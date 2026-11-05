import { apiClient } from '../api/client';
import { adminClient } from '../api/adminClient';
import { extractErrorCode } from '../apiError';
import { getAccessToken } from '../auth/storage';
import { getAdminAccessToken } from '../auth/adminStorage';
import type { FailureKind, ErrorSurface } from './failureKinds';
import { getRouteContext } from './errorContext';

export type { FailureKind, ErrorSurface };

export interface ClientErrorPayload {
  kind: FailureKind;
  reason: string;
  message?: string;
  context?: Record<string, unknown>;
}

const DEDUP_MS = 60_000;
const recentKeys = new Map<string, number>();

const TELEMETRY_PATHS = ['/telemetry/failures'];

function isTelemetryRequest(url: string | undefined): boolean {
  if (!url) return false;
  return TELEMETRY_PATHS.some((p) => url.includes(p));
}

function dedupKey(kind: string, reason: string, route: string): string {
  if (kind === 'api_error' || kind === 'query_error' || kind === 'mutation_error') {
    return `api|${reason}|${route}`;
  }
  return `${kind}|${reason}|${route}`;
}

function shouldReport(kind: string, reason: string, route: string): boolean {
  const key = dedupKey(kind, reason, route);
  const now = Date.now();
  const last = recentKeys.get(key);
  if (last != null && now - last < DEDUP_MS) return false;
  recentKeys.set(key, now);
  if (recentKeys.size > 200) {
    for (const [k, ts] of recentKeys) {
      if (now - ts > DEDUP_MS) recentKeys.delete(k);
    }
  }
  return true;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function canSend(surface: ErrorSurface): boolean {
  if (surface === 'admin') return Boolean(getAdminAccessToken());
  return Boolean(getAccessToken());
}

function sendPayload(surface: ErrorSurface, payload: ClientErrorPayload): void {
  if (!canSend(surface)) return;

  const client = surface === 'admin' ? adminClient : apiClient;
  const path = surface === 'admin' ? '/telemetry/failures' : '/api/telemetry/failures';

  void client.post(path, payload).catch(() => {});
}

/** Fire-and-forget — never throws, never blocks UI. */
export function reportClientError(payload: ClientErrorPayload): void {
  try {
    const { route, surface, area, tab } = getRouteContext();
    const reason = truncate(payload.reason, 120);
    const message = payload.message ? truncate(payload.message, 500) : undefined;

    if (!shouldReport(payload.kind, reason, route)) return;

    const context: Record<string, unknown> = {
      surface,
      route,
      ...(area ? { area } : {}),
      ...(tab ? { tab } : {}),
      ...payload.context,
    };

    sendPayload(surface, {
      kind: payload.kind,
      reason,
      message,
      context,
    });
  } catch {
    /* swallow */
  }
}

export function reportApiError(
  error: unknown,
  requestUrl: string | undefined,
  method: string | undefined,
): void {
  if (isTelemetryRequest(requestUrl)) return;

  const status = (error as { response?: { status?: number } })?.response?.status;
  const errorCode = extractErrorCode(error);

  reportClientError({
    kind: 'api_error',
    reason: errorCode,
    message: (error as Error)?.message,
    context: {
      url: requestUrl ?? null,
      method: method?.toUpperCase() ?? null,
      httpStatus: status ?? null,
      errorCode,
    },
  });
}

export function reportQueryError(error: unknown, queryKey?: unknown): void {
  reportClientError({
    kind: 'query_error',
    reason: extractErrorCode(error),
    message: error instanceof Error ? error.message : String(error),
    context: {
      queryKey: queryKey ?? null,
      errorCode: extractErrorCode(error),
    },
  });
}

export function reportMutationError(error: unknown, mutationKey?: unknown): void {
  reportClientError({
    kind: 'mutation_error',
    reason: extractErrorCode(error),
    message: error instanceof Error ? error.message : String(error),
    context: {
      mutationKey: mutationKey ?? null,
      errorCode: extractErrorCode(error),
    },
  });
}

export function reportReactError(error: Error, componentStack?: string | null): void {
  reportClientError({
    kind: 'react_error',
    reason: error.name || 'Error',
    message: error.message,
    context: {
      componentStack: componentStack ? truncate(componentStack, 2000) : null,
    },
  });
}

export function reportWindowError(message: string, source?: string, lineno?: number): void {
  reportClientError({
    kind: 'window_error',
    reason: 'runtime_error',
    message: truncate(message, 500),
    context: {
      source: source ?? null,
      lineno: lineno ?? null,
    },
  });
}

export function reportUnhandledRejection(reason: unknown): void {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'Unhandled promise rejection';

  reportClientError({
    kind: 'unhandled_rejection',
    reason: reason instanceof Error ? reason.name || 'Error' : 'rejection',
    message: truncate(message, 500),
    context: {
      errorCode: reason instanceof Error ? extractErrorCode(reason) : null,
    },
  });
}
