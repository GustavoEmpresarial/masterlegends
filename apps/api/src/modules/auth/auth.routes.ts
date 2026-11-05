import crypto from 'node:crypto';
import { FastifyInstance, FastifyReply } from 'fastify';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  changeUsernameSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  walletLinkSchema,
  ErrorCode,
  serializeError,
} from '@mll/shared';
import { config } from '../../config/env.js';
import { AppError } from '../../common/lib/errors.js';
import { authGuard, AccessTokenClaims } from '../../common/guards/auth.guard.js';
import { AuditAction, AuditService } from '../../common/lib/audit.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { EmailService } from '../email/email.service.js';
import { EmailVerificationService } from './tokens/email-verification.service.js';
import { PasswordResetService } from './tokens/password-reset.service.js';
import { RefreshTokenService } from './tokens/refresh-token.service.js';
import { WalletLinkService } from './wallet-link.service.js';
import { isTurnstileEnabled, verifyTurnstileToken } from '../../common/lib/turnstile.js';
import { PassService, PassRepository } from '../pass/pass.service.js';
import { bumpQuestTrigger } from '../events/events.routes.js';

const REFRESH_COOKIE_NAME = 'refresh_token';
const authRateLimit =
  process.env.NODE_ENV === 'test' ? undefined : { max: 5, timeWindow: '1 minute' as const };

async function assertTurnstile(
  token: string | undefined,
  ip: string | undefined,
): Promise<void> {
  if (!isTurnstileEnabled()) return;
  const valid = await verifyTurnstileToken(token, ip);
  if (!valid) {
    throw new AppError(ErrorCode.AUTH_CAPTCHA_INVALID, 400);
  }
}

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: 'auto',
    sameSite: 'lax',
    path: '/',
    maxAge: config.REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
}

export async function registerAuthRoutes(app: FastifyInstance) {
  const audit = new AuditService(app.prisma);
  const emailService = new EmailService(app.redisQueue);
  const repo = new AuthRepository(app.prisma);
  const service = new AuthService(
    repo,
    emailService,
    new EmailVerificationService(app.prisma),
    new PasswordResetService(app.prisma),
  );
  const refreshTokens = new RefreshTokenService(app, app.redis);
  const walletLink = new WalletLinkService(app.redis, repo);
  const passService = new PassService(new PassRepository(app.prisma), app.prisma);

  const signAccessToken = (claims: Omit<AccessTokenClaims, 'type'>) =>
    app.jwt.sign({ ...claims, type: 'access' }, { expiresIn: config.JWT_EXPIRY });

  // ---- CSRF token endpoint (cookie-protected routes will require X-CSRF-Token) ----
  app.get('/csrf', { schema: { tags: ['auth'] } }, async (_request, reply) => {
    const token = await reply.generateCsrf();
    return { csrfToken: token };
  });

  // ---- Legacy SPA redirects (old emails used /auth/reset-password and /auth/verify-email) ----
  app.get('/reset-password', { schema: { tags: ['auth'] } }, async (request, reply) => {
    const token = (request.query as { token?: string }).token ?? '';
    return reply.redirect(`${config.WEB_URL}/recuperar-senha?token=${encodeURIComponent(token)}`);
  });

  app.get('/verify-email', { schema: { tags: ['auth'] } }, async (request, reply) => {
    const token = (request.query as { token?: string }).token ?? '';
    return reply.redirect(`${config.WEB_URL}/verificar-email?token=${encodeURIComponent(token)}`);
  });

  app.get('/forgot-password', { schema: { tags: ['auth'] } }, async (_request, reply) => {
    return reply.redirect(`${config.WEB_URL}/esqueci-senha`);
  });

  // ---- Register ----
  app.post(
    '/register',
    {
      config: authRateLimit ? { rateLimit: authRateLimit } : {},
      schema: { tags: ['auth'] },
    },
    async (request, reply) => {
      const body = registerSchema.parse(request.body);
      await assertTurnstile(body.turnstileToken, request.ip);
      const { user } = await service.register(body, request.ip);

      // No session until email is verified and the user logs in.
      await app.prisma.userIpEvent.create({
        data: {
          userId: user.id,
          ip: request.ip,
          userAgent: request.headers['user-agent']?.slice(0, 512) ?? null,
          action: 'register',
        },
      });

      return reply.status(201).send({ ok: true as const, user });
    },
  );

  // ---- Login ----
  app.post(
    '/login',
    {
      config: authRateLimit ? { rateLimit: authRateLimit } : {},
      schema: { tags: ['auth'] },
    },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);
      await assertTurnstile(body.turnstileToken, request.ip);

      try {
        const user = await service.login(body);
        const issued = await refreshTokens.issue(user.id);
        const accessToken = signAccessToken({ sub: user.id, email: user.email });
        setRefreshCookie(reply, issued.token);

        await audit.record({
          userId: user.id,
          action: AuditAction.LOGIN_SUCCESS,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        });
        await app.prisma.userIpEvent.create({
          data: {
            userId: user.id,
            ip: request.ip,
            userAgent: request.headers['user-agent']?.slice(0, 512) ?? null,
            action: 'login',
          },
        });

        // Mission hook: daily login (idempotent via period key).
        void passService.getMissionProgressService().incrementEvent(user.id, 'login', 1);
        bumpQuestTrigger(app, user.id, 'login', 1);

        return { accessToken, user };
      } catch (err) {
        if (err instanceof AppError && err.code === ErrorCode.AUTH_ACCOUNT_LOCKED) {
          await audit.record({
            action: AuditAction.ACCOUNT_LOCKED,
            severity: 'warn',
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            meta: { email: body.email },
          });
        } else if (err instanceof AppError && err.code === ErrorCode.AUTH_INVALID_CREDENTIALS) {
          await audit.record({
            action: AuditAction.LOGIN_FAILED,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            meta: { email: body.email },
          });
        }
        throw err;
      }
    },
  );

  // ---- Refresh (cookie + CSRF) ----
  app.post(
    '/refresh',
    {
      config: { csrf: true },
      schema: { tags: ['auth'] },
    },
    async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE_NAME];
      if (!token) {
        throw new AppError(ErrorCode.AUTH_NO_REFRESH_TOKEN, 401);
      }

      try {
        const { result, userId } = await refreshTokens.rotate(token);
        setRefreshCookie(reply, result.token);

        const user = await service.findById(userId);
        const accessToken = signAccessToken({
          sub: userId,
          email: user?.email ?? undefined,
        });
        return { accessToken };
      } catch (err) {
        if (err instanceof AppError && err.code === ErrorCode.AUTH_REFRESH_REUSED) {
          await audit.record({
            action: AuditAction.REFRESH_REUSE_DETECTED,
            severity: 'warn',
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          });
        }
        throw err;
      }
    },
  );

  // ---- Logout (cookie + CSRF) ----
  app.post(
    '/logout',
    {
      config: { csrf: true },
      schema: { tags: ['auth'] },
    },
    async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE_NAME];
      if (token) {
        try {
          const decoded = app.jwt.verify<{ sub: string; familyId: string }>(token);
          await refreshTokens.revokeFamily(decoded.familyId, decoded.sub);
          await audit.record({
            userId: decoded.sub,
            action: AuditAction.LOGOUT,
            ip: request.ip,
          });
        } catch {
          /* ignore — token may be expired */
        }
      }
      reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/', secure: 'auto' });
      return { success: true };
    },
  );

  // ---- Me ----
  app.get(
    '/me',
    { preHandler: authGuard, schema: { tags: ['auth'], security: [{ bearerAuth: [] }] } },
    async (request) => service.me(request.user.id),
  );

  app.post(
    '/change-password',
    {
      preHandler: authGuard,
      schema: { tags: ['auth'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = changePasswordSchema.parse(request.body);
      await service.changePassword(request.user.id, body.currentPassword, body.newPassword);
      await audit.record({
        userId: request.user.id,
        action: AuditAction.PASSWORD_CHANGED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      return { success: true };
    },
  );

  app.post(
    '/change-username',
    {
      preHandler: authGuard,
      schema: { tags: ['auth'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = changeUsernameSchema.parse(request.body);
      const prev = await service.findById(request.user.id);
      const out = await service.changeUsername(request.user.id, body.username);
      await audit.record({
        userId: request.user.id,
        action: AuditAction.USERNAME_CHANGED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: { previous: prev?.username ?? null, next: out.username },
      });
      return out;
    },
  );

  // ---- Wallet link (email account + signed message — not SIWE login) ----
  app.get(
    '/wallet/challenge',
    { preHandler: authGuard, schema: { tags: ['auth'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const user = await service.findById(request.user.id);
      if (!user?.username) {
        throw new AppError(ErrorCode.USER_NOT_FOUND, 404);
      }
      return walletLink.createChallenge(request.user.id, user.username);
    },
  );

  app.post(
    '/wallet/link',
    {
      preHandler: authGuard,
      schema: { tags: ['auth'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = walletLinkSchema.parse(request.body);
      const result = await walletLink.linkWallet(request.user.id, body.address, body.signature);
      await audit.record({
        userId: request.user.id,
        action: AuditAction.WALLET_LINKED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: { wallet: result.wallet },
      });
      return result;
    },
  );

  app.delete(
    '/wallet/link',
    { preHandler: authGuard, schema: { tags: ['auth'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const result = await walletLink.unlinkWallet(request.user.id);
      await audit.record({
        userId: request.user.id,
        action: AuditAction.WALLET_UNLINKED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: { wallet: result.wallet },
      });
      return { success: true, wallet: result.wallet };
    },
  );

  // ---- Forgot password ----
  app.post(
    '/forgot-password',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: { tags: ['auth'] },
    },
    async (request) => {
      const body = forgotPasswordSchema.parse(request.body);
      await service.startPasswordReset(body.email, request.ip);
      await audit.record({
        action: AuditAction.PASSWORD_RESET_REQUESTED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        meta: { email: body.email },
      });
      return { ok: true };
    },
  );

  // ---- Reset password ----
  app.post(
    '/reset-password',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: { tags: ['auth'] },
    },
    async (request) => {
      const body = resetPasswordSchema.parse(request.body);
      const { userId } = await service.completePasswordReset(body.token, body.newPassword);

      // Wipe every refresh family for this user (sign out everywhere).
      await refreshTokens.revokeAllForUser(userId);

      await audit.record({
        userId,
        action: AuditAction.PASSWORD_RESET_COMPLETED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      return { ok: true };
    },
  );

  // ---- Verify email ----
  app.post(
    '/verify-email',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: { tags: ['auth'] },
    },
    async (request) => {
      const body = verifyEmailSchema.parse(request.body);
      const { userId } = await service.verifyEmail(body.token);
      await audit.record({
        userId,
        action: AuditAction.EMAIL_VERIFIED,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      return { ok: true };
    },
  );

  app.post(
    '/resend-verification',
    {
      preHandler: authGuard,
      schema: { tags: ['auth'], security: [{ bearerAuth: [] }] },
    },
    async (request) => service.resendVerificationEmail(request.user.id),
  );

  // Public resend (login gate) — rate-limited, no auth
  app.post(
    '/resend-verification-email',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: { tags: ['auth'] },
    },
    async (request) => {
      const body = resendVerificationSchema.parse(request.body);
      return service.resendVerificationByEmail(body.email);
    },
  );

  app.post(
    '/complete-tutorial',
    {
      preHandler: authGuard,
      schema: { tags: ['auth'], security: [{ bearerAuth: [] }] },
    },
    async (request) => service.completeTutorial(request.user.id),
  );

  const pairKey = (id: string) => `stadium-live:pair:${id}`;
  const handoffKey = (code: string) => `stadium-live:handoff:${code}`;
  const randomToken = () => crypto.randomBytes(24).toString('base64url');

  app.post(
    '/stadium-live/pair',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: { tags: ['auth'] },
    },
    async () => {
      const pairId = randomToken();
      const pollToken = randomToken();
      await app.redis.set(
        pairKey(pairId),
        JSON.stringify({ pollToken, status: 'pending' }),
        'EX',
        300,
      );
      return { pairId, pollToken };
    },
  );

  app.get(
    '/stadium-live/poll',
    { schema: { tags: ['auth'] } },
    async (request) => {
      const query = request.query as { pairId?: string; pollToken?: string };
      const pairId = query.pairId ?? '';
      const pollToken = query.pollToken ?? '';
      const raw = pairId ? await app.redis.get(pairKey(pairId)) : null;
      if (!raw) return { status: 'expired' as const };
      const data = JSON.parse(raw) as { pollToken?: string; status?: string; handoff?: string };
      const stored = Buffer.from(data.pollToken ?? '');
      const given = Buffer.from(pollToken);
      if (stored.length !== given.length || !crypto.timingSafeEqual(stored, given)) {
        return { status: 'expired' as const };
      }
      if (data.status === 'approved' && data.handoff) {
        return { status: 'approved' as const, handoff: data.handoff };
      }
      return { status: 'pending' as const };
    },
  );

  app.post(
    '/stadium-live/approve',
    { preHandler: authGuard, schema: { tags: ['auth'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const pairId = (request.body as { pairId?: string } | null)?.pairId ?? '';
      const raw = pairId ? await app.redis.get(pairKey(pairId)) : null;
      if (!raw) throw new AppError(ErrorCode.AUTH_UNAUTHORIZED, 404);
      const data = JSON.parse(raw) as { status?: string; handoff?: string; pollToken?: string };
      if (data.status !== 'approved' || !data.handoff) {
        data.status = 'approved';
        data.handoff = randomToken();
        await app.redis.set(pairKey(pairId), JSON.stringify(data), 'EX', 120);
        await app.redis.set(handoffKey(data.handoff), request.user.id, 'EX', 120);
      }
      return { ok: true as const };
    },
  );

  app.get(
    '/stadium-live/consume',
    { schema: { tags: ['auth'] } },
    async (request, reply) => {
      const code = (request.query as { code?: string }).code ?? '';
      const userId = code ? await app.redis.getdel(handoffKey(code)) : null;
      if (!userId) {
        return reply.redirect('/login?widget=1');
      }
      const issued = await refreshTokens.issue(userId);
      setRefreshCookie(reply, issued.token);
      return reply.redirect('/club/stadium/live?widget=1');
    },
  );

  // ---- Web3 disabled ----
  if (!config.ENABLE_WEB3_AUTH) {
    app.post('/nonce', async (_request, reply) =>
      reply.status(501).send(serializeError(ErrorCode.AUTH_WEB3_DISABLED, 501)),
    );
    app.post('/verify', async (_request, reply) =>
      reply.status(501).send(serializeError(ErrorCode.AUTH_WEB3_DISABLED, 501)),
    );
  }
}
