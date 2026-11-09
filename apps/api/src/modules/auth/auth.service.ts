import bcrypt from 'bcryptjs';
import type { LoginInput, RegisterInput, AuthUserDTO } from '@mll/shared';
import {
  collectReferrerAncestors,
  partyIsBanned,
  referralLoopReason,
  referralSelfReason,
  sharesRegistrationIp,
  type ReferralRejectReason,
} from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { AuthRepository } from './auth.repository.js';
import { EmailService } from '../email/email.service.js';
import { EmailVerificationService } from './tokens/email-verification.service.js';
import { PasswordResetService, PASSWORD_RESET_TTL_MIN } from './tokens/password-reset.service.js';
import { config } from '../../config/env.js';
import { secureRandom } from '../../common/lib/secure-random.js';

const BCRYPT_ROUNDS = 10;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MIN = 15;
const REFERRAL_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += REFERRAL_CODE_CHARS.charAt(Math.floor(secureRandom() * REFERRAL_CODE_CHARS.length));
  }
  return code;
}

export interface RegisterResult {
  user: AuthUserDTO;
  verifyToken: string;
}

export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly email: EmailService,
    private readonly emailVerification: EmailVerificationService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  private toUserDTO(user: {
    id: string;
    email: string | null;
    username: string | null;
    referralCode: string;
    wallet?: string | null;
    emailVerifiedAt?: Date | null;
    tutorialCompletedAt?: Date | null;
    telegramChatId?: string | null;
    telegramNotifyEnabled?: boolean | null;
    club?: unknown;
  }): AuthUserDTO {
    return {
      id: user.id,
      email: user.email ?? '',
      username: user.username ?? '',
      referralCode: user.referralCode,
      hasClub: !!user.club,
      wallet: user.wallet,
      emailVerified: !!user.emailVerifiedAt,
      tutorialCompleted: !!user.tutorialCompletedAt,
      telegramLinked: Boolean(user.telegramChatId),
      telegramNotifyEnabled: user.telegramNotifyEnabled ?? true,
    };
  }

  /**
   * Cria uma nova conta de usuário, valida unicidade de e-mail/username,
   * aplica código de referral se fornecido, gera hash da senha e envia
   * e-mail de verificação.
   *
   * @param input - Dados de cadastro (email, username, password, referralCode?)
   * @returns Usuário criado e token de verificação de e-mail
   * @throws {AppError} `AUTH_EMAIL_OR_USERNAME_TAKEN` se e-mail ou username já existir
   * @throws {AppError} `AUTH_INVALID_REFERRAL_CODE` se o código de referral não existir
   */
  async register(input: RegisterInput, signupIp?: string): Promise<RegisterResult> {
    const existing = await this.repo.findByEmailOrUsername(input.email, input.username);
    if (existing) {
      throw new AppError(ErrorCode.AUTH_EMAIL_OR_USERNAME_TAKEN, 400);
    }

    let referrer: Awaited<ReturnType<AuthRepository['findByReferralCode']>> = null;
    if (input.referralCode) {
      referrer = await this.repo.findByReferralCode(input.referralCode);
      if (!referrer) {
        throw new AppError(ErrorCode.AUTH_INVALID_REFERRAL_CODE, 400);
      }
    }

    const hashed = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const autoVerify =
      process.env.NODE_ENV !== 'production' && process.env.E2E_AUTO_VERIFY_EMAIL === 'true';
    const user = await this.repo.create({
      email: input.email,
      username: input.username,
      password: hashed,
      referralCode: generateReferralCode(),
      emailVerifiedAt: autoVerify ? new Date() : undefined,
    });

    // Todo novo usuário recebe o mesmo NFT vitalício definido pelo admin
    await this.repo.createStarterPlayer(user.id);

    if (referrer) {
      const attached = await this.attachReferral(referrer, user, signupIp);
      if (attached) {
        void import('../events/quest-progress.service.js').then(({ QuestProgressService }) =>
          new QuestProgressService(this.repo.prisma).incrementTrigger(
            referrer!.id,
            'referral_signup',
            1,
          ),
        );
      }
    }

    const verifyToken = await this.emailVerification.issue(user.id);
    const link = `${config.WEB_URL}/verificar-email?token=${verifyToken}`;
    await this.email.send({
      to: user.email!,
      template: 'verify-email',
      vars: { username: user.username ?? user.email!, link },
    });

    return {
      user: this.toUserDTO({ ...user, club: null }),
      verifyToken,
    };
  }

  /** Creates the link only when the pair is allowed. A refusal is stored and pays nothing. */
  private async attachReferral(
    referrer: { id: string; email: string | null; wallet: string | null; bannedAt: Date | null },
    referred: { id: string; email: string | null; wallet: string | null },
    signupIp?: string,
  ): Promise<boolean> {
    const ips = await this.repo.referrerIps(referrer.id);
    const ancestors = await collectReferrerAncestors(referrer.id, async (id) => {
      const row = await this.repo.parentReferrerId(id);
      return row?.referrerId ?? null;
    });
    const reason: ReferralRejectReason | null =
      referralSelfReason(referrer, referred)
      ?? (partyIsBanned(referrer) ? 'banned' : null)
      ?? (sharesRegistrationIp(ips.map((row) => row.ip), signupIp) ? 'duplicate_ip' : null)
      ?? referralLoopReason(ancestors, referred.id);

    if (reason) {
      await this.repo.recordRejectedReferral({
        referrerId: referrer.id,
        referredId: referred.id,
        reason,
      });
      return false;
    }

    await this.repo.setReferredBy(referred.id, referrer.id);
    await this.repo.createReferral(referrer.id, referred.id);
    await this.repo.grantReferralRewardToReferrer(referrer.id);
    return true;
  }

  /**
   * Autentica um usuário com e-mail e senha. Incrementa falhas consecutivas
   * e bloqueia a conta após `MAX_FAILED_LOGINS` tentativas por `LOCKOUT_MIN` minutos.
   *
   * @param input - Credenciais de login (email, password)
   * @returns DTO do usuário autenticado
   * @throws {AppError} `AUTH_INVALID_CREDENTIALS` se credenciais inválidas
   * @throws {AppError} `AUTH_ACCOUNT_LOCKED` se conta bloqueada por excesso de falhas
   * @throws {AppError} `USER_BANNED` se conta banida
   */
  async login(input: LoginInput): Promise<AuthUserDTO> {
    const user = await this.repo.findByEmail(input.email);
    if (!user || !user.password) {
      throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 401);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const disabled =
        user.lockedUntil.getTime() >= new Date('2099-01-01T00:00:00.000Z').getTime();
      if (disabled) {
        throw new AppError(ErrorCode.USER_DISABLED, 403);
      }
      throw new AppError(ErrorCode.AUTH_ACCOUNT_LOCKED, 423, {
        until: user.lockedUntil.toISOString(),
      });
    }

    if (user.bannedAt) {
      throw new AppError(ErrorCode.USER_BANNED, 403, { reason: user.banReason });
    }

    const valid = await bcrypt.compare(input.password, user.password);
    if (!valid) {
      await this.repo.bumpFailedLogins(user.id, MAX_FAILED_LOGINS, LOCKOUT_MIN);
      throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 401);
    }

    await this.repo.clearFailedLogins(user.id);

    if (!user.emailVerifiedAt) {
      // Password ok — block login and (re)send verification email automatically.
      try {
        await this.resendVerificationByEmail(user.email ?? '');
      } catch {
        /* still return the verify gate even if SMTP fails */
      }
      throw new AppError(ErrorCode.AUTH_EMAIL_NOT_VERIFIED, 403, {
        emailSent: true,
        email: user.email,
      });
    }

    return this.toUserDTO(user);
  }

  /**
   * Retorna o perfil do usuário autenticado pelo ID extraído do JWT.
   *
   * @param userId - ID do usuário
   * @returns DTO do usuário
   * @throws {AppError} `USER_NOT_FOUND` se o usuário não existir
   */
  async me(userId: string): Promise<AuthUserDTO> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, 404);
    }
    return this.toUserDTO(user);
  }

  async resendVerificationEmail(userId: string): Promise<{ ok: true; alreadyVerified?: boolean }> {
    const user = await this.repo.findById(userId);
    if (!user?.email) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, 404);
    }
    if (user.emailVerifiedAt) {
      return { ok: true, alreadyVerified: true };
    }

    const verifyToken = await this.emailVerification.issue(userId);
    const link = `${config.WEB_URL}/verificar-email?token=${verifyToken}`;
    await this.email.send({
      to: user.email,
      template: 'verify-email',
      vars: { username: user.username ?? user.email, link },
    });
    return { ok: true };
  }

  /**
   * Public resend (pre-login). Always returns ok — does not leak whether the email exists.
   */
  async resendVerificationByEmail(email: string): Promise<{ ok: true }> {
    const user = await this.repo.findByEmail(email);
    if (!user?.email || user.emailVerifiedAt) {
      return { ok: true };
    }

    const verifyToken = await this.emailVerification.issue(user.id);
    const link = `${config.WEB_URL}/verificar-email?token=${verifyToken}`;
    await this.email.send({
      to: user.email,
      template: 'verify-email',
      vars: { username: user.username ?? user.email, link },
    });
    return { ok: true };
  }

  async completeTutorial(userId: string): Promise<AuthUserDTO> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, 404);
    }
    if (!user.tutorialCompletedAt) {
      await this.repo.markTutorialCompleted(userId);
    }
    return this.me(userId);
  }

  async findById(userId: string) {
    return this.repo.findById(userId);
  }

  /**
   * Inicia o fluxo de reset de senha. Envia e-mail com link de reset.
   * Sempre retorna sem erro — não vaza se o e-mail existe na base.
   *
   * @param email - E-mail do usuário
   * @param ip - IP da requisição (registrado para auditoria)
   */
  async startPasswordReset(email: string, ip?: string): Promise<void> {
    const user = await this.repo.findByEmail(email);
    // Always behave as if it succeeded — do not leak whether the email exists.
    if (!user || !user.email) return;

    const { token, expiresAt } = await this.passwordReset.issue(user.id, ip);
    const link = `${config.WEB_URL}/recuperar-senha?token=${token}`;

    void this.email.send({
      to: user.email,
      template: 'reset-password',
      vars: {
        username: user.username ?? user.email,
        link,
        expiresInMin: PASSWORD_RESET_TTL_MIN,
      },
    });

    void expiresAt;
  }

  /**
   * Conclui o reset de senha consumindo o token de uso único e atualizando o hash.
   *
   * @param token - Token de reset enviado por e-mail
   * @param newPassword - Nova senha em texto puro (será hasheada)
   * @returns ID do usuário que teve a senha alterada
   * @throws {AppError} se o token for inválido ou expirado
   */
  async completePasswordReset(token: string, newPassword: string): Promise<{ userId: string }> {
    const { userId } = await this.passwordReset.consume(token);
    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.repo.updatePassword(userId, hashed);

    const user = await this.repo.findById(userId);
    if (user?.email) {
      void this.email.send({
        to: user.email,
        template: 'password-changed',
        vars: { username: user.username ?? user.email },
      });
    }

    return { userId };
  }

  async verifyEmail(token: string): Promise<{ userId: string }> {
    return this.emailVerification.consume(token);
  }

  /**
   * Altera o username do usuário, verificando unicidade.
   *
   * @param userId - ID do usuário
   * @param newUsername - Novo username desejado (normalizado para lowercase)
   * @returns Novo username aplicado
   * @throws {AppError} `USER_NOT_FOUND` se usuário não existir
   * @throws {AppError} `AUTH_EMAIL_OR_USERNAME_TAKEN` se username já estiver em uso
   */
  async changeUsername(userId: string, newUsername: string): Promise<{ username: string }> {
    const user = await this.repo.findById(userId);
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND, 404);

    const normalized = newUsername.trim().toLowerCase();
    if (user.username === normalized) return { username: normalized };

    const taken = await this.repo.findByUsername(normalized);
    if (taken && taken.id !== userId) {
      throw new AppError(ErrorCode.AUTH_EMAIL_OR_USERNAME_TAKEN, 409);
    }

    await this.repo.updateUsername(userId, normalized);
    return { username: normalized };
  }

  /**
   * Altera a senha do usuário após validar a senha atual.
   *
   * @param userId - ID do usuário
   * @param currentPassword - Senha atual em texto puro para verificação
   * @param newPassword - Nova senha em texto puro
   * @throws {AppError} `AUTH_INVALID_CREDENTIALS` se senha atual incorreta
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user?.password) throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 401);

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, 401);

    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.repo.updatePassword(userId, hashed);

    if (user.email) {
      void this.email.send({
        to: user.email,
        template: 'password-changed',
        vars: { username: user.username ?? user.email },
      });
    }
  }
}
