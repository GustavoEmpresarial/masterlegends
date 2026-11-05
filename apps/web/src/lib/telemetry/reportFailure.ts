import type { FailureKind } from './failureKinds';
import { reportClientError } from './reportClientError';

export type { FailureKind };

interface FailurePayload {
  kind: FailureKind;
  reason: string;
  message?: string;
  context?: Record<string, unknown>;
}

/** Fire-and-forget — never throws, never blocks UI. */
export function reportFailure(payload: FailurePayload): void {
  reportClientError(payload);
}
