import { ErrorCode, ErrorCodeType, serializeError } from '@mll/shared';

export { ErrorCode, serializeError };
export type { ErrorCodeType };

/**
 * Erro de domínio da aplicação com código semântico e status HTTP.
 * Lançado pelos services e capturado pelo `errorHandler` plugin do Fastify,
 * que serializa `code` e `details` na resposta JSON.
 */
export class AppError extends Error {
  readonly code: ErrorCodeType;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  /**
   * @param code - Código de erro padronizado de `ErrorCode`
   * @param statusCode - Status HTTP que será retornado ao cliente
   * @param details - Dados adicionais opcionais incluídos na resposta
   */
  constructor(code: ErrorCodeType, statusCode: number, details?: Record<string, unknown>) {
    super(code);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
