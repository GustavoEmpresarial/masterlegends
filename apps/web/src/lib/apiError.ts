import i18n from '../i18n';
import { ErrorCode, ErrorCodeType } from '@mll/shared';

export interface ApiErrorPayload {
  code?: ErrorCodeType;
  statusCode?: number;
  details?: Record<string, unknown>;
}

/**
 * Extrai o código de erro semântico de uma resposta de API ou erro de rede.
 * Suporta erros do Axios (`error.response.data.error.code`), erros de rede (`ERR_NETWORK`)
 * e erros com `code` direto.
 *
 * @param error - Qualquer valor capturado em um `catch`
 * @returns Código de erro string (ex: `AUTH_INVALID_CREDENTIALS`, `ERR_NETWORK`)
 */
export function extractErrorCode(error: unknown): string {
  const anyErr = error as {
    response?: { status?: number; data?: { error?: ApiErrorPayload; code?: string } };
    data?: { error?: ApiErrorPayload; code?: string };
    code?: string;
    message?: string;
  } | undefined;
  const status = anyErr?.response?.status;
  const data = anyErr?.response?.data ?? anyErr?.data;
  const code = data?.error?.code ?? data?.code ?? anyErr?.code;
  if (status === 502 || status === 503 || status === 504) {
    return code === ErrorCode.MAINTENANCE_MODE ? code : 'ERR_BAD_RESPONSE';
  }
  if (typeof code === 'string') {
    if (code === 'ERR_BAD_RESPONSE') return code;
    return code;
  }
  const msg = anyErr?.message;
  if (typeof msg === 'string' && /^(WALLET_|AUTH_WALLET_)/.test(msg)) {
    return msg;
  }
  if (typeof msg === 'string' && /rate limit exceeded/i.test(msg)) {
    return ErrorCode.RATE_LIMITED_USER;
  }
  if (anyErr?.message === 'Network Error' || anyErr?.code === 'ERR_NETWORK') {
    return 'ERR_NETWORK';
  }
  return ErrorCode.UNKNOWN;
}

/**
 * Traduz um erro de API para uma string localizada via i18next.
 * Usa o namespace `errors:` e retorna a tradução de `UNKNOWN` como fallback
 * se a chave não existir.
 *
 * @param error - Qualquer valor capturado em um `catch`
 * @param fallbackCode - Código usado quando `error` não contém código identificável
 * @returns Mensagem de erro traduzida para o idioma atual
 */
export function translateError(error: unknown, fallbackCode: string = ErrorCode.UNKNOWN): string {
  const code = extractErrorCode(error) || fallbackCode;
  const key = `errors:${code}`;
  if (i18n.exists(key)) {
    return i18n.t(key);
  }
  const fallbackKey = `errors:${fallbackCode}`;
  if (fallbackCode !== code && i18n.exists(fallbackKey)) {
    return i18n.t(fallbackKey);
  }
  return i18n.t(`errors:${ErrorCode.UNKNOWN}`);
}
