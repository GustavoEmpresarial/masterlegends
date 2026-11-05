import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OfferwallService } from './offerwall.service.js';
import { authGuard } from '../../common/guards/auth.guard.js';
import { config } from '../../config/env.js';
import { logger } from '../../common/lib/logger.js';

const ptcCallbackQuerySchema = z.object({
  pwd: z.string().optional().default(''),
  user: z.string().min(1),
  amount: z.coerce.number(),
  clicks: z.coerce.number().int().optional().default(0),
});

/** Compara em tempo constante — evita timing attack no shared secret `pwd`. */
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function registerOfferwallRoutes(app: FastifyInstance) {
  const offerwall = new OfferwallService(app.prisma);

  /**
   * Callback PTC do Zerads. Chamado pelo servidor deles (~a cada 5 min), NÃO pelo navegador
   * do jogador — por isso é GET com querystring, não JSON assinado.
   *
   * Segurança: a ÚNICA defesa real é o `pwd` (comparado em tempo constante). NÃO validar por
   * IP de origem — o site fica atrás da Cloudflare, então a conexão que chega no container
   * já é o proxy da Cloudflare, não o IP real do servidor Zerads (isso quebraria sempre).
   * Idempotência: garantida pela constraint única no banco (userId+janela de 5 min), então
   * um reenvio duplicado do mesmo callback não credita duas vezes — não precisa de lock extra.
   */
  app.get(
    '/zerads/ptc',
    { config: { public: true }, schema: { tags: ['offerwall'], security: [] } },
    async (request, reply) => {
      const parsed = ptcCallbackQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(200).send('OK'); // não dá pistas de validação pra fora
      }

      if (!config.OFFERWALL_ZERADS_ENABLED || !config.OFFERWALL_ZERADS_PTC_PASSWORD) {
        return reply.status(200).send('OK');
      }

      if (!timingSafeEqual(parsed.data.pwd, config.OFFERWALL_ZERADS_PTC_PASSWORD)) {
        logger.warn(
          { event: 'zerads_ptc.bad_password', ip: request.ip },
          'Zerads PTC callback com senha inválida',
        );
        return reply.status(200).send('OK');
      }

      const userId = parsed.data.user;
      const userExists = await app.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!userExists) {
        logger.warn({ event: 'zerads_ptc.unknown_user', userId }, 'Zerads PTC: userId desconhecido');
        return reply.status(200).send('OK');
      }

      try {
        const result = await offerwall.processPtcCallback({
          userId,
          zerAmount: parsed.data.amount,
          clicks: parsed.data.clicks,
        });
        logger.info(
          {
            event: 'zerads_ptc.callback',
            userId,
            amount: parsed.data.amount,
            clicks: parsed.data.clicks,
            granted: result.granted,
            overwall: result.overwall,
          },
          'Zerads PTC callback processado',
        );
      } catch (err) {
        logger.error({ event: 'zerads_ptc.error', err, userId }, 'Falha ao processar callback Zerads PTC');
      }

      return reply.status(200).send('OK');
    },
  );

  app.get(
    '/zerads/link',
    { preHandler: [authGuard], schema: { tags: ['offerwall'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const enabled = config.OFFERWALL_ZERADS_ENABLED;
      const url = `https://zerads.com/ptc.php?ref=${config.OFFERWALL_ZERADS_SITE_ID}&user=${encodeURIComponent(request.user.id)}`;
      return { url, enabled };
    },
  );

  app.get(
    '/zerads/stats',
    { preHandler: [authGuard], schema: { tags: ['offerwall'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      return offerwall.getPtcStats(request.user.id);
    },
  );

  app.get(
    '/rewards',
    {
      preHandler: [authGuard],
      schema: { tags: ['offerwall'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      return offerwall.getRewards(request.user.id);
    },
  );
}
