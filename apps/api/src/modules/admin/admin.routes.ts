import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  adminHasPermission,
  AdminPermission,
  adminLoginSchema,
  adminVerify2faSchema,
  ErrorCode,
  type AdminPermissionType,
  type AdminRoleType,
} from '@mll/shared';
import { AdminPermissionConfigService } from './admin-permission-config.service.js';
import { config } from '../../config/env.js';
import { AuditAction, AuditService } from '../../common/lib/audit.js';
import { AppError } from '../../common/lib/errors.js';
import {
  adminGuard,
  type AdminAccessClaims,
} from '../../common/guards/admin.guard.js';
import { EmailService } from '../email/email.service.js';
import { findAdminById, findAdminByLogin } from './admin.config.js';
import { Admin2faService } from './admin-2fa.service.js';
import { AdminSessionService } from './admin-session.service.js';
import { AdminService } from './admin.service.js';
import { getAdminJwt } from './admin-jwt.js';
import { registerAdminPanelRoutes } from './admin-panel.routes.js';
import { registerItemTemplateRoutes } from '../items/item-template.routes.js';
import { registerStadiumRoutes } from '../stadium/stadium.routes.js';
import { registerStadiumShopAdminRoutes } from '../stadium-shop/stadium-shop-admin.routes.js';
import { registerVestiarioAdminRoutes } from '../vestiario/vestiario-admin.routes.js';
import { registerOfficeAdminRoutes } from '../office/office-admin.routes.js';
import { registerEventsAdminRoutes } from '../events/events-admin.routes.js';
import { registerAdminWarehouseRoutes } from './admin-warehouse.routes.js';
import { registerAdminOfferwallRoutes } from './admin-offerwall.routes.js';
import { registerAdminAuditHook } from '../../common/lib/admin-audit-hook.js';

const ADMIN_REFRESH_COOKIE = 'admin_refresh_token';
const ADMIN_ACCESS_COOKIE = 'admin_access';

const adminRateLimit =
  process.env.NODE_ENV === 'test' ? undefined : { max: 5, timeWindow: '1 minute' as const };

function setAdminRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie(ADMIN_REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: 'auto',
    sameSite: 'lax',
    path: '/',
    maxAge: config.ADMIN_REFRESH_MAX_AGE_SECONDS,
  });
}

function setAdminAccessCookie(reply: FastifyReply, token: string) {
  reply.setCookie(ADMIN_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: 'auto',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15,
  });
}

function clearAdminCookies(reply: FastifyReply) {
  reply.clearCookie(ADMIN_REFRESH_COOKIE, { path: '/', secure: 'auto' });
  reply.clearCookie(ADMIN_ACCESS_COOKIE, { path: '/', secure: 'auto' });
}

export async function registerAdminRoutes(app: FastifyInstance) {
  registerAdminAuditHook(app);
  const audit = new AuditService(app.prisma);
  const emailService = new EmailService(app.redisQueue);
  const twoFa = new Admin2faService(app.redis);
  const sessions = new AdminSessionService(app, app.redis);
  const service = new AdminService(twoFa);
  const signAdminAccess = (admin: {
    id: string;
    login: string;
    role: AdminRoleType;
    email: string;
  }) =>
    getAdminJwt(app).sign(
      {
        sub: admin.id,
        login: admin.login,
        role: admin.role,
        email: admin.email,
        type: 'admin',
      } satisfies AdminAccessClaims,
      { expiresIn: config.ADMIN_JWT_EXPIRY },
    );

  app.get('/csrf', { schema: { tags: ['admin'] } }, async (_request, reply) => {
    const token = await reply.generateCsrf();
    return { csrfToken: token };
  });

  app.post(
    '/login',
    {
      config: adminRateLimit ? { rateLimit: adminRateLimit } : {},
      schema: { tags: ['admin'] },
    },
    async (request, reply) => {
      const body = adminLoginSchema.parse(request.body);

      try {
        if (config.ADMIN_2FA_DISABLED) {
          const adminUser = await service.validateCredentials(body.login, body.password);
          const issued = await sessions.issue(adminUser.id);
          const accessToken = signAdminAccess(adminUser);

          setAdminRefreshCookie(reply, issued.token);
          setAdminAccessCookie(reply, accessToken);

          await audit.record({
            action: AuditAction.ADMIN_LOGIN_SUCCESS,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            meta: { adminId: adminUser.id, role: adminUser.role, twoFaSkipped: true },
          });

          return { accessToken, admin: service.toPublic(adminUser) };
        }

        const { challengeId, code, expiresIn } = await service.startLogin(body.login, body.password);
        const adminConfig = findAdminByLogin(body.login)!;

        await emailService.send({
          to: adminConfig.email,
          template: 'admin-2fa',
          vars: {
            login: adminConfig.login,
            code,
            expiresInMin: Math.ceil(expiresIn / 60),
          },
        });

        await audit.record({
          action: AuditAction.ADMIN_2FA_SENT,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          meta: { adminId: adminConfig.id, role: adminConfig.role },
        });

        return reply.send({ challengeId, expiresIn });
      } catch (err) {
        if (err instanceof AppError && err.code === ErrorCode.ADMIN_INVALID_CREDENTIALS) {
          await audit.record({
            action: AuditAction.ADMIN_LOGIN_FAILED,
            severity: 'warn',
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            meta: { login: body.login },
          });
        }
        throw err;
      }
    },
  );

  app.post(
    '/verify-2fa',
    {
      config: adminRateLimit ? { rateLimit: adminRateLimit } : {},
      schema: { tags: ['admin'] },
    },
    async (request, reply) => {
      const body = adminVerify2faSchema.parse(request.body);

      try {
        const adminUser = await service.complete2fa(body.challengeId, body.code);
        const issued = await sessions.issue(adminUser.id);
        const accessToken = signAdminAccess(adminUser);

        setAdminRefreshCookie(reply, issued.token);
        setAdminAccessCookie(reply, accessToken);

        await audit.record({
          action: AuditAction.ADMIN_LOGIN_SUCCESS,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          meta: { adminId: adminUser.id, role: adminUser.role },
        });

        return { accessToken, admin: service.toPublic(adminUser) };
      } catch (err) {
        await audit.record({
          action: AuditAction.ADMIN_2FA_FAILED,
          severity: 'warn',
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        });
        throw err;
      }
    },
  );

  app.post(
    '/refresh',
    {
      config: { csrf: true },
      schema: { tags: ['admin'] },
    },
    async (request, reply) => {
      const raw = request.cookies[ADMIN_REFRESH_COOKIE];
      if (!raw) {
        throw new AppError(ErrorCode.AUTH_NO_REFRESH_TOKEN, 401);
      }

      const { result, adminId } = await sessions.rotate(raw);
      const adminUser = findAdminById(adminId);
      if (!adminUser) {
        throw new AppError(ErrorCode.ADMIN_UNAUTHORIZED, 401);
      }

      const accessToken = signAdminAccess(adminUser);
      setAdminRefreshCookie(reply, result.token);
      setAdminAccessCookie(reply, accessToken);

      return { accessToken, admin: service.toPublic(adminUser) };
    },
  );

  app.post(
    '/logout',
    {
      config: { csrf: true },
      schema: { tags: ['admin'] },
    },
    async (request, reply) => {
      const raw = request.cookies[ADMIN_REFRESH_COOKIE];
      if (raw) await sessions.revokeFromToken(raw);
      clearAdminCookies(reply);
      return { ok: true };
    },
  );

  app.get(
    '/me',
    {
      preHandler: adminGuard,
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const all = Object.values(AdminPermission) as AdminPermissionType[];
      let permissions: AdminPermissionType[];
      if (request.admin.role === 'super') {
        permissions = all;
      } else {
        const permService = new AdminPermissionConfigService(
          request.server.prisma,
          request.server.redisQueue,
        );
        const dbPerms = await permService.getPermissions(request.admin.id);
        permissions = dbPerms ?? all.filter((p) => adminHasPermission(request.admin.role, p));
      }
      return {
        admin: {
          id: request.admin.id,
          login: request.admin.login,
          role: request.admin.role,
          permissions,
        },
      };
    },
  );

  await registerAdminPanelRoutes(app);
  await registerItemTemplateRoutes(app);
  await registerStadiumRoutes(app);
  await registerStadiumShopAdminRoutes(app);
  await registerVestiarioAdminRoutes(app);
  await registerOfficeAdminRoutes(app);
  await registerEventsAdminRoutes(app);
  await registerAdminWarehouseRoutes(app);
  await registerAdminOfferwallRoutes(app);
}