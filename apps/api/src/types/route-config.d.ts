import 'fastify';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Rotas com cookie de refresh exigem header X-CSRF-Token */
    csrf?: boolean;
    /** Opt-out do authGuard global em /api/* (nenhuma rota usa hoje) */
    public?: boolean;
    /** Adiciona verifiedEmailGuard após authGuard (scout mint, marketplace search) */
    requireVerifiedEmail?: boolean;
  }
}
