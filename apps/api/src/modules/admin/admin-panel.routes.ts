import { getPassRewardCatalog } from '../pass/pass-reward.service.js';
import { getDefaultPassTemplate } from '../pass/pass-template.service.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import {
  AdminPermission,
  ErrorCode,
  adminResetPasswordSchema,
  adminUpdateUserProfileSchema,
  adminPermissionConfigSchema,
  passSeasonCreateSchema,
  passSeasonPatchSchema,
  announcementCreateSchema,
  announcementPatchSchema,
  banUserSchema,
  deactivateUserSchema,
  rejectWithdrawalSchema,
  approveWithdrawalSchema,
  adminWithdrawalHistoryQuerySchema,
  supportMessageSchema,
  supportTicketPatchSchema,
  walletConfigPatchSchema,
  socialRejectSchema,
  NotificationType,
} from '@mll/shared';
import { AppError } from '../../common/lib/errors.js';
import { AuditAction, AuditService } from '../../common/lib/audit.js';
import { adminGuard, requireAdminPermission, requireAdminRole } from '../../common/guards/admin.guard.js';
import { AnnouncementService } from '../announcements/announcement.service.js';
import { PlatformConfigService } from '../platform/platform-config.service.js';
import { SupportService } from '../support/support.service.js';
import { WithdrawalRequestService } from '../wallet/withdrawal-request.service.js';
import { SatspayError, getSatspayUsdtBalance } from '../wallet/satspay-client.js';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { AdminReferralsService } from './admin-referrals.service.js';
import { AdminPermissionConfigService } from './admin-permission-config.service.js';
import { AdminOverviewService } from './admin-overview.service.js';
import { AdminReportsService } from './admin-reports.service.js';
import { AdminRoiService } from './admin-roi.service.js';
import { AdminUsersService } from './admin-users.service.js';
import { parseAdminUserListFilters } from './admin-user-filters.util.js';
import { PassSeasonAdminService } from '../pass/pass-season.service.js';
import { SocialService } from '../social/social.service.js';
import { queryLogs, getLogStats } from './admin-logs.service.js';
import { listFailures, summarizeFailures } from './admin-failures.service.js';
import { AdminSecurityService } from './admin-security.service.js';
import { z } from 'zod';
import { OfficeService } from '../office/office.service.js';
import { AfflictionService } from '../afflictions/affliction.service.js';
import { registerTransparencyAdminRoutes } from '../transparency/transparency.routes.js';
import { registerRoadmapAdminRoutes } from '../roadmap/roadmap.routes.js';
import { registerNoticesAdminRoutes } from '../notices/notices.routes.js';
import { registerAdminTelemetryRoutes } from './admin-telemetry.routes.js';
import {
  buildAdminBroadcast,
  createTelegramService,
  msgAfflictionApplied,
  msgAfflictionBroadcastGlobal,
  msgAfflictionCut,
  msgAnnouncement,
  msgSupportReplied,
  msgWithdrawalApproved,
  msgWithdrawalSatspay,
  msgWithdrawalProofGlobal,
  msgWithdrawalRejected,
} from '../telegram/telegram.service.js';
import { EmailService } from '../email/email.service.js';
import { EmailMarketingService } from '../email/email-marketing.service.js';
import { saveNoticeImage } from '../../common/lib/uploads.js';

export async function registerAdminPanelRoutes(app: FastifyInstance) {
  await registerAdminTelemetryRoutes(app);
  const audit = new AuditService(app.prisma);
  const overview = new AdminOverviewService(app.prisma);
  const users = new AdminUsersService(app.prisma);
  const reports = new AdminReportsService(app.prisma);
  const roi = new AdminRoiService(app.prisma);
  const withdrawals = new WithdrawalRequestService(app.prisma);
  const platform = new PlatformConfigService(app.prisma);
  const announcements = new AnnouncementService(app.prisma);
  const support = new SupportService(app.prisma);
  const dashboard = new AdminDashboardService(app.prisma);
  const adminReferrals = new AdminReferralsService(app.prisma);
  const adminPermConfigs = new AdminPermissionConfigService(app.prisma, app.redisQueue);
  const passSeasons = new PassSeasonAdminService(app.prisma);
  const social = new SocialService(app.prisma);
  const security = new AdminSecurityService(app.prisma);
  const office = new OfficeService(app.prisma);
  const afflictions = new AfflictionService(app.prisma);
  const telegram = createTelegramService(app);
  const emailMarketing = new EmailMarketingService(
    app.prisma,
    new EmailService(app.redisQueue),
    app.redis,
  );

  app.get(
    '/overview',
    { preHandler: [adminGuard], schema: { tags: ['admin'], security: [{ bearerAuth: [] }] } },
    async () => overview.getOverview(),
  );

  const logsQuerySchema = z.object({
    level: z.string().optional(),
    service: z.string().optional(),
    q: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  });

  app.get(
    '/logs',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_PLATFORM)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const q = logsQuerySchema.parse(request.query);
      return queryLogs(q);
    },
  );

  app.get(
    '/logs/stats',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_PLATFORM)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => getLogStats(),
  );

  const failuresQuerySchema = z.object({
    kind: z.string().optional(),
    reason: z.string().optional(),
    userId: z.string().optional(),
    surface: z.string().optional(),
    route: z.string().optional(),
    area: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  });

  app.get(
    '/failures',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_REPORTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const q = failuresQuerySchema.parse(request.query);
      return listFailures(q);
    },
  );

  app.get(
    '/failures/summary',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_REPORTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const q = failuresQuerySchema.pick({ from: true, to: true, surface: true, area: true }).parse(request.query);
      return summarizeFailures(q);
    },
  );

  app.get(
    '/security/multi-ip-users',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_PLATFORM)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => ({ alerts: await security.getMultiIpUsers() }),
  );

  app.get(
    '/security/shared-ips',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_PLATFORM)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => ({ clusters: await security.getSharedIps() }),
  );

  app.get(
    '/users',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const q = request.query as Record<string, string | undefined>;
      const limit = Math.min(Number(q.limit ?? 50), 100);
      return users.listUsers({ limit, cursor: q.cursor, ...parseAdminUserListFilters(q) });
    },
  );

  app.get(
    '/users/:id/account',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => users.getUserAccount((request.params as { id: string }).id),
  );

  app.get(
    '/users/:id/roi',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_REPORTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => roi.getUserRoi((request.params as { id: string }).id),
  );

  app.get(
    '/roi/platform',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_REPORTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => roi.getPlatformRoi(),
  );

  app.get(
    '/roi/users',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_REPORTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const q = request.query as {
        search?: string;
        limit?: string;
        offset?: string;
        sort?: string;
      };
      const limit = Math.min(Number(q.limit ?? 50), 100);
      const offset = Math.max(0, Number(q.offset ?? 0));
      const SORT_OPTIONS = ['mining_desc', 'capital_desc', 'roi_desc', 'name_asc'] as const;
      const sortRaw = q.sort ?? 'mining_desc';
      const sort = SORT_OPTIONS.includes(sortRaw as (typeof SORT_OPTIONS)[number])
        ? (sortRaw as (typeof SORT_OPTIONS)[number])
        : 'mining_desc';
      return roi.listUsersRoi({ search: q.search, limit, offset, sort });
    },
  );

  app.get(
    '/users/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => users.getUser((request.params as { id: string }).id),
  );

  app.post(
    '/users/:id/ban',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = banUserSchema.parse(request.body);
      const result = await users.banUser(id, body.reason, request.admin.login);
      await audit.record({
        action: AuditAction.USER_BANNED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: { adminLogin: request.admin.login, targetId: id, reason: body.reason },
      });
      return result;
    },
  );

  app.post(
    '/users/:id/unban',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const result = await users.unbanUser(id);
      await audit.record({
        action: AuditAction.USER_UNBANNED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: { adminLogin: request.admin.login, targetId: id },
      });
      return result;
    },
  );

  app.post(
    '/users/:id/deactivate',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = deactivateUserSchema.parse(request.body);
      const result = await users.deactivateUser(id, body.reason, request.admin.login);
      await audit.record({
        action: AuditAction.USER_DEACTIVATED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: { adminLogin: request.admin.login, targetId: id, reason: body.reason },
      });
      return result;
    },
  );

  app.post(
    '/users/:id/reactivate',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const result = await users.reactivateUser(id);
      await audit.record({
        action: AuditAction.USER_REACTIVATED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: { adminLogin: request.admin.login, targetId: id },
      });
      return result;
    },
  );

  app.patch(
    '/users/:id/profile',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = adminUpdateUserProfileSchema.parse(request.body);
      request.log.info(
        { adminLogin: request.admin.login, targetId: id, fields: Object.keys(body), payload: body },
        'admin.users.patch_profile.start',
      );
      const result = await users.updateUserProfile(id, body);
      request.log.info(
        { adminLogin: request.admin.login, targetId: id, fieldsApplied: Object.keys(body) },
        'admin.users.patch_profile.ok',
      );
      await audit.record({
        action: AuditAction.ADMIN_USER_PROFILE_UPDATED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: { adminLogin: request.admin.login, targetId: id, fields: Object.keys(body) },
      });
      return result;
    },
  );

  app.post(
    '/users/:id/reset-password',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = adminResetPasswordSchema.parse(request.body);
      const result = await users.resetPassword(id, body.password);
      await audit.record({
        action: AuditAction.ADMIN_PASSWORD_RESET,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: { adminLogin: request.admin.login, targetId: id },
      });
      return result;
    },
  );

  const afflictionApplySchema = z.object({
    targetKind: z.enum(['coach', 'treasurer', 'base_player', 'nft_player']),
    targetId: z.string().max(64).optional().nullable(),
    code: z.string().min(2).max(64),
    durationMinutes: z.number().int().min(1).max(60 * 24 * 30),
    note: z.string().max(255).optional(),
  });

  app.get(
    '/users/:id/afflictions',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const items = await afflictions.listAllForUser(id);
      return { items };
    },
  );

  app.post(
    '/users/:id/afflictions',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = afflictionApplySchema.parse(request.body);
      const row = await afflictions.apply({
        userId: id,
        targetKind: body.targetKind,
        targetId: body.targetId ?? null,
        code: body.code,
        durationMinutes: body.durationMinutes,
        note: body.note,
        createdBy: request.admin.login,
      });
      await audit.record({
        action: AuditAction.ADMIN_AFFLICTION_APPLIED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: {
          adminLogin: request.admin.login,
          targetUserId: id,
          afflictionId: row.id,
          targetKind: body.targetKind,
          code: body.code,
          durationMinutes: body.durationMinutes,
        },
      });
      const afflictionMsg = msgAfflictionApplied({
        targetKind: body.targetKind,
        code: body.code,
        durationMinutes: body.durationMinutes,
        note: body.note,
      });
      void telegram.enqueueUser(
        id,
        afflictionMsg.text,
        NotificationType.AFFLICTION_APPLIED,
        afflictionMsg.replyMarkup,
      );
      if (body.targetKind === 'coach' || body.targetKind === 'treasurer') {
        void telegram.enqueueGlobal(
          afflictionMsg.text,
          NotificationType.AFFLICTION_APPLIED,
          afflictionMsg.replyMarkup,
        );
      }
      try {
        app.notifications.notify(id, NotificationType.AFFLICTION_APPLIED, {
          targetKind: body.targetKind,
          code: body.code,
          durationMinutes: body.durationMinutes,
        });
      } catch {
        /* ignore */
      }
      return row;
    },
  );

  app.delete(
    '/afflictions/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const row = await afflictions.remove(id);
      await audit.record({
        action: AuditAction.ADMIN_AFFLICTION_REMOVED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: { adminLogin: request.admin.login, afflictionId: id, code: row.code },
      });
      return { ok: true };
    },
  );

  const afflictionBroadcastSchema = z.object({
    targetKind: z.enum(['coach', 'treasurer']),
    code: z.string().min(2).max(64),
    durationMinutes: z.number().int().min(1).max(60 * 24 * 30),
    note: z.string().max(255).optional(),
    scope: z.enum(['all', 'with_staff']).default('with_staff'),
  });

  app.post(
    '/afflictions/broadcast',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = afflictionBroadcastSchema.parse(request.body);
      const expiresAt = new Date(Date.now() + body.durationMinutes * 60_000);
      const staffField = body.targetKind === 'coach' ? 'coachHiredAt' : 'treasurerHiredAt';
      const clubs = await app.prisma.club.findMany({
        where:
          body.scope === 'with_staff' ? { [staffField]: { not: null } } : undefined,
        select: { userId: true },
      });
      if (clubs.length === 0) return { ok: true, applied: 0 };
      await app.prisma.affliction.createMany({
        data: clubs.map((c) => ({
          userId: c.userId,
          targetKind: body.targetKind,
          targetId: null,
          code: body.code,
          note: body.note ?? null,
          expiresAt,
          createdBy: request.admin.login,
        })),
      });
      await audit.record({
        action: AuditAction.ADMIN_AFFLICTION_APPLIED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: {
          adminLogin: request.admin.login,
          broadcast: true,
          scope: body.scope,
          targetKind: body.targetKind,
          code: body.code,
          durationMinutes: body.durationMinutes,
          affected: clubs.length,
        },
      });
      const userMsg = msgAfflictionApplied({
        targetKind: body.targetKind,
        code: body.code,
        durationMinutes: body.durationMinutes,
        note: body.note,
      });
      const globalMsg = msgAfflictionBroadcastGlobal({
        targetKind: body.targetKind,
        code: body.code,
        durationMinutes: body.durationMinutes,
        affected: clubs.length,
        note: body.note,
      });
      void telegram.enqueueGlobal(
        globalMsg.text,
        NotificationType.AFFLICTION_APPLIED,
        globalMsg.replyMarkup,
      );
      void telegram.enqueueManyUsers(
        clubs.map((c) => c.userId),
        userMsg.text,
        NotificationType.AFFLICTION_APPLIED,
        userMsg.replyMarkup,
      );
      return { ok: true, applied: clubs.length };
    },
  );

  app.get(
    '/afflictions/active',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => {
      const rows = await app.prisma.affliction.findMany({
        where: { expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: 'asc' },
        take: 200,
      });
      return { items: rows };
    },
  );

  const afflictionCutSchema = z.object({
    /** Staff kind to clear. Omit to cut both coach + treasurer. */
    targetKind: z.enum(['coach', 'treasurer']).optional(),
    /** If set, only cut this event code. */
    code: z.string().min(2).max(64).optional(),
    /** Notify affected users on Telegram (default true). */
    notify: z.boolean().optional().default(true),
  });

  app.post(
    '/afflictions/cut',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = afflictionCutSchema.parse(request.body ?? {});
      const result = await afflictions.cutActive({
        targetKind: body.targetKind,
        code: body.code,
      });

      await audit.record({
        action: AuditAction.ADMIN_AFFLICTION_REMOVED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: {
          adminLogin: request.admin.login,
          cut: true,
          targetKind: body.targetKind ?? 'coach+treasurer',
          code: body.code ?? null,
          removed: result.removed,
          users: result.userIds.length,
        },
      });

      if (result.removed > 0) {
        const msg = body.targetKind
          ? msgAfflictionCut({ targetKind: body.targetKind, code: body.code })
          : msgAfflictionCut({ targetKind: 'coach', code: body.code });
        const text = body.targetKind
          ? msg.text
          : [
              `⚡️ <b>MLL · GENESIS DAO</b>`,
              `━━━━━━━━━━━━━━━━━━━━`,
              `✂️ <b>EVENTO ENCERRADO</b>`,
              '',
              `Os eventos ativos do Escritório (treinador/tesoureiro) foram cortados pela administração.`,
              '',
              `O staff voltou a cumprir as funções passivas normalmente.`,
            ]
              .filter(Boolean)
              .join('\n');
        if (body.notify && result.userIds.length > 0) {
          void telegram.enqueueManyUsers(
            result.userIds,
            text,
            'affliction.cut',
            msg.replyMarkup,
          );
        }
        void telegram.enqueueGlobal(text, 'affliction.cut', msg.replyMarkup);
      }

      return {
        ok: true,
        removed: result.removed,
        usersNotified: body.notify ? result.userIds.length : 0,
      };
    },
  );

  const officeKindSchema = z.object({ kind: z.enum(['treasurer', 'coach']) });

  app.post(
    '/users/:id/office/:kind/hire',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const { kind } = officeKindSchema.parse(request.params);
      const result = await office.adminHire(id, kind);
      await audit.record({
        action: AuditAction.ADMIN_OFFICE_HIRE,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: { adminLogin: request.admin.login, targetId: id, staff: kind },
      });
      return result;
    },
  );

  app.post(
    '/users/:id/office/:kind/fire',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const { kind } = officeKindSchema.parse(request.params);
      const result = await office.adminFire(id, kind);
      await audit.record({
        action: AuditAction.ADMIN_OFFICE_FIRE,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: { adminLogin: request.admin.login, targetId: id, staff: kind },
      });
      return result;
    },
  );

  app.post(
    '/reports/recheck-deposit',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_REPORTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = z
        .object({ txHash: z.string().min(10).max(80) })
        .parse(request.body);
      const txHash = body.txHash.toLowerCase().trim();

      const existing = await app.prisma.walletTransaction.findUnique({
        where: { txHash },
        include: { user: { select: { username: true, email: true } } },
      });
      if (existing) {
        return {
          status: 'already_recorded',
          txHash,
          amountUsdc: Math.abs(Number(existing.amount)),
          type: existing.type,
          createdAt: existing.createdAt.toISOString(),
          user: existing.user
            ? existing.user.username ?? existing.user.email ?? null
            : null,
        };
      }

      const redis = app.redisQueue ?? app.redis;
      if (!redis) return { status: 'redis_unavailable' };

      const { ethers } = await import('ethers');
      const {
        ERC20_TRANSFER_TOPIC,
        getPolygonUsdcAddresses,
        isPolygonUsdcAddress,
        parseTreasuryTransferTopicLog,
        ChainEvent,
      } = await import('@mll/shared');
      const { JobQueues } = await import('../../common/lib/queues.js');
      const { config } = await import('../../config/env.js');

      const treasury = config.CONTRACT_USDC_VAULT?.toLowerCase();
      const usdcAddrs = getPolygonUsdcAddresses(config.USDC_ADDRESS);
      if (!treasury || usdcAddrs.length === 0) {
        return { status: 'config_missing' };
      }

      const rpcUrl = config.CHAIN_ID === 137 ? config.POLYGON_RPC_URL : config.AMOY_RPC_URL;
      if (!rpcUrl) return { status: 'rpc_unavailable' };

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) return { status: 'tx_not_found' };
      if (receipt.status !== 1) return { status: 'tx_failed' };

      const transferLog = receipt.logs.find((log) => {
        if (!isPolygonUsdcAddress(log.address, config.USDC_ADDRESS)) return false;
        return log.topics[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC;
      });
      if (!transferLog) return { status: 'not_a_usdc_transfer' };

      const parsed = parseTreasuryTransferTopicLog(
        [...transferLog.topics] as string[],
        transferLog.data,
        treasury,
      );
      if (!parsed) return { status: 'not_to_treasury' };

      const userRow = await app.prisma.user.findUnique({
        where: { wallet: parsed.wallet },
        select: { id: true, username: true, email: true, wallet: true },
      });
      if (!userRow) {
        return {
          status: 'wallet_not_linked',
          fromWallet: parsed.wallet,
          amountUsdc: Number(parsed.amount) / 1_000_000,
          hint: 'Nenhum usuário tem essa carteira vinculada. Vincule a carteira ao usuário antes de reprocessar.',
        };
      }

      const queues = new JobQueues(redis);
      await queues.enqueueChainEvent(ChainEvent.UsdcDeposited, {
        user: parsed.wallet,
        amount: parsed.amount.toString(),
        txHash,
        blockNumber: receipt.blockNumber.toString(),
      });

      return {
        status: 'queued',
        txHash,
        amountUsdc: Number(parsed.amount) / 1_000_000,
        user: userRow.username ?? userRow.email ?? userRow.id.slice(0, 8),
      };
    },
  );

  app.get(
    '/reports/summary',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_REPORTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const q = request.query as { from?: string; to?: string };
      return reports.summary(q.from, q.to);
    },
  );

  app.get(
    '/reports/deposits',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_REPORTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const q = request.query as { limit?: string; cursor?: string; from?: string; to?: string; search?: string };
      const limit = Math.min(Number(q.limit ?? 50), 100);
      return reports.listDeposits(limit, q.cursor, q.from, q.to, q.search);
    },
  );

  app.get(
    '/reports/withdrawals',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_REPORTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const q = request.query as { limit?: string; cursor?: string; from?: string; to?: string; search?: string };
      const limit = Math.min(Number(q.limit ?? 50), 100);
      return reports.listWithdrawals(limit, q.cursor, q.from, q.to, q.search);
    },
  );

  app.get(
    '/withdrawals',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_WITHDRAWALS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const q = request.query as { status?: string; limit?: string; cursor?: string };
      const limit = Math.min(Number(q.limit ?? 50), 100);
      return withdrawals.listAdmin(q.status, limit, q.cursor);
    },
  );

  app.get(
    '/withdrawals/history',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_WITHDRAWALS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const q = adminWithdrawalHistoryQuerySchema.parse(request.query ?? {});
      const result = await withdrawals.history(q);
      await audit.record({
        action: AuditAction.WITHDRAWAL_HISTORY_VIEWED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: {
          adminLogin: request.admin.login,
          page: q.page,
          limit: q.limit,
          status: q.status ?? 'all',
          period: q.period ?? 'all',
          total: result.pagination.total,
        },
      });
      return result;
    },
  );

  app.post(
    '/withdrawals/history/export-audit',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_WITHDRAWALS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = (request.body ?? {}) as { format?: string; total?: number };
      await audit.record({
        action: AuditAction.WITHDRAWAL_HISTORY_EXPORTED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: {
          adminLogin: request.admin.login,
          format: body.format ?? 'csv',
          total: body.total ?? null,
        },
      });
      return { ok: true };
    },
  );

  app.get(
    '/withdrawals/satspay-balance',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_WITHDRAWALS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => {
      try {
        return await getSatspayUsdtBalance();
      } catch (err) {
        const code = err instanceof SatspayError ? err.code : 'SEND_FAILED';
        return { configured: Boolean(code !== 'NOT_CONFIGURED'), usdt: null, error: code };
      }
    },
  );

  app.post(
    '/withdrawals/:id/satspay-send',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_WITHDRAWALS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const result = await withdrawals.sendViaSatspay(id, request.admin.login);
      await audit.record({
        action: AuditAction.WITHDRAWAL_APPROVED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: {
          adminLogin: request.admin.login,
          withdrawalId: id,
          txHash: result.txHash,
          paymentMethod: 'satspay',
          satspayEmail: result.satspayEmail,
        },
      });
      try {
        app.notifications.notify(result.userId, NotificationType.WITHDRAWAL_APPROVED, {
          withdrawalId: id,
          amountUsdc: result.amountUsdc,
          rail: 'satspay',
        });
      } catch {
        /* ignore */
      }
      const userMsg = msgWithdrawalSatspay({
        amountUsdc: result.amountUsdc,
        referenceId: result.txHash,
        toEmail: result.satspayEmail,
      });
      void telegram.enqueueUser(
        result.userId,
        userMsg.text,
        NotificationType.WITHDRAWAL_APPROVED,
        userMsg.replyMarkup,
      );
      const proof = msgWithdrawalSatspay({
        amountUsdc: result.amountUsdc,
        referenceId: result.txHash,
      });
      void telegram.enqueueGlobal(
        proof.text,
        NotificationType.WITHDRAWAL_APPROVED,
        proof.replyMarkup,
      );
      return result;
    },
  );

  app.get(
    '/withdrawals/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_WITHDRAWALS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return withdrawals.getById(id);
    },
  );

  app.post(
    '/withdrawals/:id/approve',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_WITHDRAWALS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = approveWithdrawalSchema.parse(request.body ?? {});
      const result = await withdrawals.approve(
        id,
        request.admin.login,
        body.txHash,
        body.paymentMethod,
      );
      await audit.record({
        action: AuditAction.WITHDRAWAL_APPROVED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: {
          adminLogin: request.admin.login,
          withdrawalId: id,
          txHash: result.txHash,
          paymentMethod: result.paymentMethod,
        },
      });
      try {
        app.notifications.notify(result.userId, NotificationType.WITHDRAWAL_APPROVED, {
          withdrawalId: id,
          amountUsdc: result.amountUsdc,
        });
      } catch {
        /* ignore */
      }
      {
        const msg = msgWithdrawalApproved({
          amountUsdc: result.amountUsdc,
          txHash: result.txHash,
        });
        void telegram.enqueueUser(
          result.userId,
          msg.text,
          NotificationType.WITHDRAWAL_APPROVED,
          msg.replyMarkup,
        );
        const proof = msgWithdrawalProofGlobal({
          amountUsdc: result.amountUsdc,
          txHash: result.txHash,
        });
        void telegram.enqueueGlobal(
          proof.text,
          NotificationType.WITHDRAWAL_APPROVED,
          proof.replyMarkup,
        );
      }
      return result;
    },
  );

  app.post(
    '/withdrawals/:id/reject',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_WITHDRAWALS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = rejectWithdrawalSchema.parse(request.body);
      const result = await withdrawals.reject(id, request.admin.login, body.reason);
      await audit.record({
        action: AuditAction.WITHDRAWAL_REJECTED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: { adminLogin: request.admin.login, withdrawalId: id, reason: body.reason },
      });
      try {
        app.notifications.notify(result.userId, NotificationType.WITHDRAWAL_REJECTED, {
          withdrawalId: id,
          reason: body.reason,
        });
      } catch {
        /* ignore */
      }
      {
        const msg = msgWithdrawalRejected(body.reason);
        void telegram.enqueueUser(
          result.userId,
          msg.text,
          NotificationType.WITHDRAWAL_REJECTED,
          msg.replyMarkup,
        );
      }
      return result;
    },
  );

  app.get(
    '/wallet-config',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_WALLET_CONFIG)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => platform.get(),
  );

  app.patch(
    '/wallet-config',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_WALLET_CONFIG)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const before = await platform.get();
      const body = walletConfigPatchSchema.parse(request.body);
      const result = await platform.update(body, request.admin.login);

      if (body.withdrawalsPaused !== undefined && body.withdrawalsPaused !== before.withdrawalsPaused) {
        await audit.record({
          action: body.withdrawalsPaused ? AuditAction.WITHDRAWALS_PAUSED : AuditAction.WITHDRAWALS_RESUMED,
          severity: 'warn',
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          meta: { adminLogin: request.admin.login, withdrawalsPaused: body.withdrawalsPaused },
        });
      }

      return result;
    },
  );

  app.post(
    '/referral-nft/sync',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_WALLET_CONFIG)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { source, name, imageUrl, overwall, position } = request.body as {
        source: 'referral' | 'referral_gift';
        name?: string;
        imageUrl?: string | null;
        overwall?: number;
        position?: number;
      };
      if (source !== 'referral' && source !== 'referral_gift') {
        return { error: 'source must be referral or referral_gift' };
      }
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (imageUrl !== undefined) data.imageUrl = imageUrl;
      if (overwall !== undefined) data.overwall = overwall;
      if (position !== undefined) data.position = position;
      const result = await app.prisma.basePlayer.updateMany({
        where: { source },
        data,
      });
      return { updated: result.count };
    },
  );

  app.get(
    '/announcements',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => ({ announcements: await announcements.list() }),
  );

  app.post(
    '/announcements',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = announcementCreateSchema.parse(request.body);
      const created = await announcements.create(body, request.admin.login);
      if (created.active) {
        const msg = msgAnnouncement(created.title, created.body);
        void telegram.enqueueGlobal(msg.text, NotificationType.ANNOUNCEMENT, msg.replyMarkup);
      }
      return created;
    },
  );

  const telegramBroadcastSchema = z
    .object({
      text: z.string().min(1).max(3500),
      target: z.enum(['dm', 'global', 'both']),
      dmMode: z.enum(['all', 'user']).optional(),
      username: z.string().min(1).max(64).optional(),
      format: z.enum(['card', 'html']).optional().default('card'),
      title: z.string().min(1).max(64).optional(),
      photoUrl: z.string().max(1024).optional(),
      buttons: z
        .array(
          z.object({
            text: z.string().min(1).max(64),
            url: z.string().url().max(512),
          }),
        )
        .max(6)
        .optional(),
      disableWebPagePreview: z.boolean().optional().default(true),
    })
    .superRefine((body, ctx) => {
      const needsDm = body.target === 'dm' || body.target === 'both';
      const dmMode = body.dmMode ?? 'all';
      if (needsDm && dmMode === 'user' && !body.username?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['username'],
          message: 'username is required when dmMode is user',
        });
      }
      if (body.photoUrl?.trim() && body.text.trim().length > 1024) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['text'],
          message: 'text max 1024 when photoUrl is set (Telegram caption limit)',
        });
      }
    });

  app.get(
    '/telegram/admin-status',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => telegram.getAdminStatus(),
  );

  app.post(
    '/telegram/upload-image',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const data = await (request as FastifyRequest & { file: () => Promise<MultipartFile> }).file();
      if (!data) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'empty_file' });
      }
      const buffer = await data.toBuffer();
      if (!buffer.byteLength) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'empty_file' });
      }
      const { url } = await saveNoticeImage(buffer, data.mimetype);
      const absoluteUrl = telegram.resolvePublicMediaUrl(url) ?? url;
      return { url, absoluteUrl };
    },
  );

  app.post(
    '/telegram/broadcast',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = telegramBroadcastSchema.parse(request.body);
      if (!telegram.enabled) {
        return { ok: false, globalSent: false, dmSent: 0, reason: 'telegram_disabled' };
      }

      const msg = buildAdminBroadcast({
        format: body.format ?? 'card',
        title: body.title,
        text: body.text,
        buttons: body.buttons,
      });
      const photoUrl = telegram.resolvePublicMediaUrl(body.photoUrl);
      const media = {
        photoUrl,
        disableWebPagePreview: body.disableWebPagePreview !== false,
      };

      let globalSent = false;
      let dmSent = 0;

      if (body.target === 'global' || body.target === 'both') {
        globalSent = await telegram.enqueueGlobal(
          msg.text,
          'admin_broadcast',
          msg.replyMarkup,
          media,
        );
      }

      if (body.target === 'dm' || body.target === 'both') {
        const dmMode = body.dmMode ?? 'all';
        if (dmMode === 'user') {
          const user = await telegram.findLinkedByUsername(body.username!);
          if (!user) {
            throw new AppError(ErrorCode.USER_NOT_FOUND, 404, {
              reason: 'telegram_user_not_linked',
            });
          }
          if (!user.telegramNotifyEnabled) {
            throw new AppError(ErrorCode.USER_NOT_FOUND, 404, {
              reason: 'telegram_notify_disabled',
            });
          }
          const ok = await telegram.enqueueUser(
            user.id,
            msg.text,
            'admin_broadcast_dm',
            msg.replyMarkup,
            media,
          );
          dmSent = ok ? 1 : 0;
        } else {
          const ids = await telegram.listNotifyLinkedUserIds();
          dmSent = await telegram.enqueueManyUsers(
            ids,
            msg.text,
            'admin_broadcast_dm',
            msg.replyMarkup,
            media,
          );
        }
      }

      const ok =
        (body.target === 'global' && globalSent) ||
        (body.target === 'dm' && dmSent > 0) ||
        (body.target === 'both' && (globalSent || dmSent > 0));

      return {
        ok,
        globalSent,
        dmSent,
        ...(!ok && body.target !== 'dm' && !globalSent ? { reason: 'global_not_configured' } : {}),
      };
    },
  );

  const emailBroadcastSchema = z
    .object({
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(10000),
      audience: z.enum(['all', 'user']),
      username: z.string().min(1).max(64).optional(),
      format: z.enum(['plain', 'html']).optional().default('plain'),
      imageUrl: z.string().max(1024).optional(),
      buttons: z
        .array(
          z.object({
            text: z.string().min(1).max(64),
            url: z.string().url().max(512),
          }),
        )
        .max(6)
        .optional(),
    })
    .superRefine((body, ctx) => {
      if (body.audience === 'user' && !body.username?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['username'],
          message: 'username is required when audience is user',
        });
      }
    });

  app.get(
    '/email/admin-status',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => emailMarketing.getAdminStatus(),
  );

  app.get(
    '/email/campaigns',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const q = request.query as { limit?: string };
      const limit = q.limit ? Number(q.limit) : 50;
      return emailMarketing.listCampaigns(Number.isFinite(limit) ? limit : 50);
    },
  );

  app.post(
    '/email/upload-image',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const data = await (request as FastifyRequest & { file: () => Promise<MultipartFile> }).file();
      if (!data) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'empty_file' });
      }
      const buffer = await data.toBuffer();
      if (!buffer.byteLength) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'empty_file' });
      }
      const { url } = await saveNoticeImage(buffer, data.mimetype);
      const absoluteUrl = emailMarketing.resolvePublicMediaUrl(url) ?? url;
      return { url, absoluteUrl };
    },
  );

  app.post(
    '/email/broadcast',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = emailBroadcastSchema.parse(request.body);
      return emailMarketing.broadcast({
        subject: body.subject,
        body: body.body,
        audience: body.audience,
        username: body.username,
        adminLogin: request.admin.login,
        format: body.format,
        imageUrl: body.imageUrl,
        buttons: body.buttons,
      });
    },
  );

  app.patch(
    '/announcements/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = announcementPatchSchema.parse(request.body);
      return announcements.update(id, body);
    },
  );

  app.delete(
    '/announcements/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_ANNOUNCEMENTS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return announcements.remove(id);
    },
  );

  app.get('/pass/reward-catalog', {
    preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_PASS)],
    schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
  }, async () => ({ items: await getPassRewardCatalog(app.prisma) }));

  app.get(
    '/pass/template',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_PASS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => getDefaultPassTemplate(app.prisma),
  );

  app.get(
    '/pass/seasons',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_PASS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => ({ seasons: await passSeasons.list() }),
  );

  app.post(
    '/pass/seasons',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_PASS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => passSeasons.create(request.body),
  );

  app.patch(
    '/pass/seasons/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_PASS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return passSeasons.update(Number(id), request.body);
    },
  );

  app.delete(
    '/pass/seasons/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_PASS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return passSeasons.remove(Number(id));
    },
  );

  app.get(
    '/support/tickets',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SUPPORT)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const q = request.query as Record<string, string | undefined>;
      const limit = Math.min(Number(q.limit ?? 50), 100);
      const userFilters = parseAdminUserListFilters(q);
      return support.listAdmin(q.status, limit, q.cursor, userFilters);
    },
  );

  app.get(
    '/support/tickets/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SUPPORT)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => support.getTicketAdmin((request.params as { id: string }).id),
  );

  app.post(
    '/support/tickets/:id/messages',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SUPPORT)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = supportMessageSchema.parse(request.body);
      const result = await support.addAdminMessage(id, request.admin.login, body.body);
      try {
        app.notifications.notify(result.userId, NotificationType.SUPPORT_REPLIED, {
          ticketId: result.ticketId,
          subject: result.subject,
          preview: result.preview,
        });
      } catch {
        /* socket emit must not fail the reply */
      }
      {
        const msg = msgSupportReplied({
          subject: result.subject,
          preview: result.preview,
        });
        void telegram.enqueueUser(
          result.userId,
          msg.text,
          NotificationType.SUPPORT_REPLIED,
          msg.replyMarkup,
        );
      }
      return result.message;
    },
  );

  app.get(
    '/support/attachments/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SUPPORT)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { file } = await support.getAttachmentForAdmin(id);
      reply
        .header('Content-Type', file.mimeType)
        .header('Content-Disposition', 'inline; filename="attachment"')
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'private, no-store')
        .send(file.buffer);
    },
  );

  app.patch(
    '/support/tickets/:id',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SUPPORT)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = supportTicketPatchSchema.parse(request.body);
      request.log.info(
        { adminLogin: request.admin.login, ticketId: id, fields: Object.keys(body), payload: body },
        'admin.support.patch_ticket.start',
      );
      const result = await support.patchTicket(id, body);
      request.log.info(
        { adminLogin: request.admin.login, ticketId: id, status: result.status, priority: result.priority },
        'admin.support.patch_ticket.ok',
      );
      return result;
    },
  );

  app.get(
    '/referrals/overview',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_REFERRALS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => adminReferrals.overview(),
  );

  app.get(
    '/referrals',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_REFERRALS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { search, limit, cursor } = request.query as {
        search?: string;
        limit?: string;
        cursor?: string;
      };
      return adminReferrals.list({
        search,
        limit: limit ? Number(limit) : undefined,
        cursor,
      });
    },
  );

  app.get(
    '/audit-logs',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_AUDIT)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const limit = Math.min(Number((request.query as { limit?: string }).limit ?? 50), 100);
      const cursor = (request.query as { cursor?: string }).cursor;
      return dashboard.listAuditLogs(limit, cursor);
    },
  );

  app.get(
    '/social/creators/pending',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SOCIAL)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => social.listPendingCreators(),
  );

  app.get(
    '/social/creators/approved',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SOCIAL)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => social.listApprovedCreators(),
  );

  app.get(
    '/social/videos/pending',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SOCIAL)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => social.listPendingVideos(),
  );

  app.get(
    '/social/videos/approved',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SOCIAL)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => social.listApprovedVideos(),
  );

  app.post(
    '/social/creators/:id/approve',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SOCIAL)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return social.approveCreator(id, request.admin.login);
    },
  );

  app.post(
    '/social/creators/:id/reject',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SOCIAL)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = socialRejectSchema.parse(request.body);
      return social.rejectCreator(id, request.admin.login, body.reason);
    },
  );

  app.post(
    '/social/creators/:id/revoke',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SOCIAL)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = socialRejectSchema.parse(request.body);
      return social.revokeCreator(id, request.admin.login, body.reason);
    },
  );

  app.post(
    '/social/videos/:id/approve',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SOCIAL)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return social.approveVideo(id, request.admin.login);
    },
  );

  app.post(
    '/social/videos/:id/reject',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SOCIAL)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = socialRejectSchema.parse(request.body);
      return social.rejectVideo(id, request.admin.login, body.reason);
    },
  );

  app.post(
    '/social/videos/:id/revoke',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_SOCIAL)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = socialRejectSchema.parse(request.body);
      return social.revokeVideo(id, request.admin.login, body.reason);
    },
  );

  // ── Referral commissions ──────────────────────────────────────────────────

  app.get(
    '/referrals/commissions/overview',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_REFERRALS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { referrerId } = request.query as { referrerId?: string };
      return adminReferrals.commissionsOverview(referrerId);
    },
  );

  app.get(
    '/referrals/commissions',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.VIEW_REFERRALS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { referrerId, from, to, limit, cursor } = request.query as {
        referrerId?: string;
        from?: string;
        to?: string;
        limit?: string;
        cursor?: string;
      };
      return adminReferrals.commissions({
        referrerId,
        from,
        to,
        limit: limit ? Number(limit) : undefined,
        cursor,
      });
    },
  );

  // ── Admin permission management (super only) ──────────────────────────────

  app.get(
    '/admins',
    {
      preHandler: [adminGuard, requireAdminRole('super')],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => adminPermConfigs.listAdmins(),
  );

  app.get(
    '/admins/:adminId/permissions',
    {
      preHandler: [adminGuard, requireAdminRole('super')],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { adminId } = request.params as { adminId: string };
      const perms = await adminPermConfigs.getPermissions(adminId);
      const config = await app.prisma.adminPermissionConfig.findUnique({ where: { adminId } });
      return {
        adminId,
        permissions: perms,
        config: config
          ? {
              adminId: config.adminId,
              permissions: config.permissions,
              updatedBy: config.updatedBy,
              updatedAt: config.updatedAt.toISOString(),
            }
          : null,
      };
    },
  );

  app.put(
    '/admins/:adminId/permissions',
    {
      preHandler: [adminGuard, requireAdminRole('super')],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request, reply) => {
      const { adminId } = request.params as { adminId: string };
      const body = adminPermissionConfigSchema.parse(request.body);

      // Cannot modify another super admin's permissions
      const { getAdminUsers } = await import('./admin.config.js');
      const target = getAdminUsers().find((u) => u.id === adminId);
      if (!target) return reply.status(404).send({ error: 'Admin not found' });
      if (target.role === 'super') {
        return reply.status(403).send({ error: 'Cannot configure permissions for super admins' });
      }

      const result = await adminPermConfigs.set(
        adminId,
        body.permissions as import('@mll/shared').AdminPermissionType[],
        request.admin.login,
      );
      return result;
    },
  );

  app.delete(
    '/admins/:adminId/permissions',
    {
      preHandler: [adminGuard, requireAdminRole('super')],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { adminId } = request.params as { adminId: string };
      await adminPermConfigs.delete(adminId);
      return { ok: true };
    },
  );

  // ── Trophy routes ────────────────────────────────────────────────────
  app.post(
    '/users/:id/trophies',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        name: z.string().min(1).max(128),
        description: z.string().max(512).optional(),
        imageUrl: z.string().url().max(512).optional(),
        wonAt: z.string().datetime().optional(),
      }).parse(request.body);

      const club = await app.prisma.club.findUnique({ where: { userId: id }, select: { id: true } });
      if (!club) return { error: 'Club not found' };

      const trophy = await app.prisma.clubTrophy.create({
        data: {
          clubId: club.id,
          name: body.name,
          description: body.description ?? null,
          imageUrl: body.imageUrl ?? null,
          wonAt: body.wonAt ? new Date(body.wonAt) : new Date(),
          grantedBy: request.admin.login,
        },
      });
      return { trophy };
    },
  );

  app.get(
    '/users/:id/trophies',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const club = await app.prisma.club.findUnique({ where: { userId: id }, select: { id: true } });
      if (!club) return { trophies: [] };
      const trophies = await app.prisma.clubTrophy.findMany({
        where: { clubId: club.id },
        orderBy: { wonAt: 'desc' },
      });
      return { trophies };
    },
  );

  app.delete(
    '/trophies/:trophyId',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { trophyId } = request.params as { trophyId: string };
      await app.prisma.clubTrophy.delete({ where: { id: trophyId } });
      return { ok: true };
    },
  );

  // ── Grant player (FT card) to user ──────────────────────────────────
  app.post(
    '/users/:id/grant-player',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        rarity:    z.number().int().min(0).max(5),
        position:  z.number().int().min(0).max(4),
        overwall:  z.number().int().min(1).max(9999),
        name:      z.string().min(1).max(64).optional(),
        imageUrl:  z
          .string()
          .max(512)
          .refine((v) => v.startsWith('/') || /^https?:\/\//i.test(v), {
            message: 'imageUrl must be a path or http(s) URL',
          })
          .optional()
          .nullable(),
        templateId: z.string().uuid().optional().nullable(),
        source:    z.string().max(32).default('admin_grant'),
        expiresAt: z.string().datetime().optional().nullable(),
        count:     z.number().int().min(1).max(100).default(1),
      }).parse(request.body);

      const user = await app.prisma.user.findUnique({ where: { id }, select: { id: true } });
      if (!user) return reply.status(404).send({ error: 'User not found' });

      const players = await app.prisma.$transaction(async (tx) => {
        const created = [];
        for (let i = 0; i < body.count; i++) {
          const player = await tx.basePlayer.create({
            data: {
              userId: id,
              rarity: body.rarity,
              position: body.position,
              overwall: body.overwall,
              name: body.name ?? null,
              imageUrl: body.imageUrl ?? null,
              templateId: body.templateId ?? null,
              source: body.source,
              expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
            },
          });
          created.push(player);
        }

        const agg = await tx.basePlayer.aggregate({
          where: { userId: id },
          _sum: { overwall: true },
        });
        await tx.club.updateMany({
          where: { userId: id },
          data: { totalOverwall: agg._sum.overwall ?? 0 },
        });

        return created;
      });

      await audit.record({
        action: AuditAction.ADMIN_REQUEST,
        userId: id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: {
          adminLogin: request.admin.login,
          targetId: id,
          playerIds: players.map((p) => p.id),
          count: body.count,
          rarity: body.rarity,
          position: body.position,
          overwall: body.overwall,
          source: body.source,
        },
      });

      return { player: players[0], players, count: players.length };
    },
  );

  // ── List item templates (for grant-player selector) ──────────────────
  app.get(
    '/item-templates',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_USERS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => {
      const templates = await app.prisma.itemTemplate.findMany({
        select: { id: true, name: true, imageUrl: true, rarity: true, position: true, overwall: true },
        orderBy: [{ rarity: 'desc' }, { overwall: 'desc' }],
        take: 200,
      });
      return { templates };
    },
  );

  // ── Transparency & Notices admin routes ─────────────────────────────
  registerTransparencyAdminRoutes(app);
  registerRoadmapAdminRoutes(app);
  registerNoticesAdminRoutes(app);
}
