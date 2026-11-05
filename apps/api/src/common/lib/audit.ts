import type { Prisma, PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

export const AuditAction = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  ACCOUNT_LOCKED: 'account_locked',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'password_reset_completed',
  EMAIL_VERIFIED: 'email_verified',
  REFRESH_REUSE_DETECTED: 'refresh_reuse_detected',
  LOGOUT: 'logout',
  WALLET_LINKED: 'wallet_linked',
  WALLET_UNLINKED: 'wallet_unlinked',
  ADMIN_LOGIN_SUCCESS: 'admin_login_success',
  ADMIN_LOGIN_FAILED: 'admin_login_failed',
  ADMIN_2FA_SENT: 'admin_2fa_sent',
  ADMIN_2FA_FAILED: 'admin_2fa_failed',
  USER_BANNED: 'user_banned',
  USER_UNBANNED: 'user_unbanned',
  ADMIN_PASSWORD_RESET: 'admin_password_reset',
  ADMIN_USER_PROFILE_UPDATED: 'admin_user_profile_updated',
  USER_DEACTIVATED: 'user_deactivated',
  USER_REACTIVATED: 'user_reactivated',
  WITHDRAWAL_APPROVED: 'withdrawal_approved',
  WITHDRAWAL_REJECTED: 'withdrawal_rejected',
  WITHDRAWAL_HISTORY_VIEWED: 'withdrawal_history_viewed',
  WITHDRAWAL_HISTORY_EXPORTED: 'withdrawal_history_exported',
  PASSWORD_CHANGED: 'password_changed',
  USERNAME_CHANGED: 'username_changed',
  ADMIN_REQUEST: 'admin_request',
  ADMIN_OFFICE_HIRE: 'admin_office_hire',
  ADMIN_OFFICE_FIRE: 'admin_office_fire',
  ADMIN_AFFLICTION_APPLIED: 'admin_affliction_applied',
  ADMIN_AFFLICTION_REMOVED: 'admin_affliction_removed',
  MINING_PAUSED: 'mining_paused',
  MINING_RESUMED: 'mining_resumed',
  WITHDRAWALS_PAUSED: 'withdrawals_paused',
  WITHDRAWALS_RESUMED: 'withdrawals_resumed',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditEntry {
  userId?: string | null;
  action: AuditActionType;
  severity?: 'info' | 'warn' | 'error';
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
}

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  async record(entry: AuditEntry): Promise<void> {
    const severity = entry.severity ?? 'info';
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          severity,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
          meta: (entry.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      logger.error({ err, action: entry.action }, 'Failed to persist audit log');
    }

    const logFn = severity === 'warn' ? logger.warn : severity === 'error' ? logger.error : logger.info;
    logFn.call(
      logger,
      {
        event: 'audit',
        action: entry.action,
        severity,
        userId: entry.userId,
        ip: entry.ip,
        meta: entry.meta,
      },
      `audit:${entry.action}`,
    );
  }
}
