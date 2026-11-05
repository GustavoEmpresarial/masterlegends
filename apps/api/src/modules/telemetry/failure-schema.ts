import { z } from 'zod';

export const failureKinds = [
  'support_upload',
  'support_submit',
  'wallet_connect',
  'wallet_sign',
  'wallet_chain_switch',
  'wallet_link',
  'deposit',
  'react_error',
  'unhandled_rejection',
  'window_error',
  'api_error',
  'query_error',
  'mutation_error',
  'other',
] as const;

export const reportFailureSchema = z.object({
  kind: z.enum(failureKinds),
  reason: z.string().min(1).max(120),
  message: z.string().max(500).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type ReportFailureInput = z.infer<typeof reportFailureSchema>;

export const reportRateLimit = { max: 30, timeWindow: '1 minute' as const };

export function extractFailureFields(data: ReportFailureInput) {
  const ctx = data.context ?? {};
  return {
    kind: data.kind,
    reason: data.reason,
    message: data.message ?? null,
    context: ctx,
    surface: typeof ctx.surface === 'string' ? ctx.surface : null,
    route: typeof ctx.route === 'string' ? ctx.route : null,
    area: typeof ctx.area === 'string' ? ctx.area : null,
    tab: typeof ctx.tab === 'string' ? ctx.tab : null,
  };
}
