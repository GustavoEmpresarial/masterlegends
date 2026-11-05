import { FastifyInstance } from 'fastify';
import { walletTransactionsQuerySchema, withdrawRequestSchema, trackDepositSchema, swapGmtSchema } from '@mll/shared';
import { DepositTrackerService } from './deposit-tracker.service.js';
import { PlatformConfigService } from '../platform/platform-config.service.js';
import { SwapService } from './swap.service.js';
import { WalletRepository } from './wallet.repository.js';
import { WalletService } from './wallet.service.js';
import { WithdrawalRequestService } from './withdrawal-request.service.js';

export async function registerWalletRoutes(app: FastifyInstance) {
  const platform = new PlatformConfigService(app.prisma);
  const service = new WalletService(
    new WalletRepository(app.prisma),
    platform,
    app.prisma,
    app.redis,
  );
  const withdrawals = new WithdrawalRequestService(app.prisma);
  const swapService = new SwapService(app.prisma);
  const depositTracker = new DepositTrackerService(
    new WalletRepository(app.prisma),
    app.prisma,
    app.redisQueue,
  );

  app.post(
    '/deposits/track',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: { tags: ['wallet'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = trackDepositSchema.parse(request.body);
      return depositTracker.trackDeposit(request.user.id, body.txHash, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
    },
  );

  app.get(
    '/deposits/claims',
    { schema: { tags: ['wallet'], security: [{ bearerAuth: [] }] } },
    async (request) => depositTracker.listClaims(request.user.id),
  );

  app.get(
    '/summary',
    { schema: { tags: ['wallet'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getSummary(request.user.id),
  );

  app.post(
    '/swap',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: { tags: ['wallet'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = swapGmtSchema.parse(request.body);
      return swapService.swap(request.user.id, body);
    },
  );

  app.get(
    '/mining-analytics',
    { schema: { tags: ['wallet'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getMiningAnalytics(request.user.id),
  );

  app.get(
    '/transactions',
    { schema: { tags: ['wallet'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const query = walletTransactionsQuerySchema.parse(request.query);
      return service.getTransactions(request.user.id, query);
    },
  );

  app.post(
    '/withdraw-requests',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: { tags: ['wallet'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = withdrawRequestSchema.parse(request.body);
      const request_ = await withdrawals.createRequest(request.user.id, body.amountUsdc, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        satspayEmail: body.satspayEmail,
      });
      return { request: request_ };
    },
  );

  app.get(
    '/withdraw-requests',
    { schema: { tags: ['wallet'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const requests = await withdrawals.listForUser(request.user.id);
      return { requests };
    },
  );

  app.get(
    '/history',
    { schema: { tags: ['wallet'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const rows = await app.prisma.auditLog.findMany({
        where: {
          userId: request.user.id,
          action: { in: ['wallet_linked', 'wallet_unlinked'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return {
        history: rows.map((r) => ({
          id: r.id,
          action: r.action === 'wallet_linked' ? ('linked' as const) : ('unlinked' as const),
          wallet:
            (r.meta as { wallet?: string } | null)?.wallet ?? null,
          ip: r.ip ?? null,
          userAgent: r.userAgent ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  );
}
