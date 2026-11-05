export const FAILURE_KINDS = [
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

export type FailureKind = (typeof FAILURE_KINDS)[number];

export type ErrorSurface = 'player' | 'admin' | 'public';
