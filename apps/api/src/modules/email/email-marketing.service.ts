import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { ErrorCode, type EmailJob } from '@mll/shared';
import { AppError } from '../../common/lib/errors.js';
import { config } from '../../config/env.js';
import { EmailService } from './email.service.js';
import {
  getMarketingQuota,
  releaseMarketingReservation,
  tryReserveMarketing,
} from './email-marketing-quota.js';

const MAX_ALL_RECIPIENTS = 5000;
const ELIGIBLE_WHERE = {
  email: { not: null },
  emailVerifiedAt: { not: null },
} as const;

export type MarketingButton = { text: string; url: string };

export class EmailMarketingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly email: EmailService,
    private readonly redis: Redis,
  ) {}

  resolvePublicMediaUrl(url: string | undefined | null): string | undefined {
    if (!url?.trim()) return undefined;
    const u = url.trim();
    if (/^https?:\/\//i.test(u)) return u;
    const base = (config.WEB_URL || '').replace(/\/$/, '');
    if (!base) return u.startsWith('/') ? u : `/${u}`;
    return `${base}${u.startsWith('/') ? u : `/${u}`}`;
  }

  async getAdminStatus() {
    const [eligibleUsers, quota] = await Promise.all([
      this.prisma.user.count({ where: ELIGIBLE_WHERE }),
      getMarketingQuota(this.redis),
    ]);
    return {
      smtpConfigured: this.email.smtpConfigured,
      from: this.email.smtpFrom,
      eligibleUsers,
      ...quota,
    };
  }

  async listCampaigns(limit = 50) {
    const take = Math.min(Math.max(limit, 1), 100);
    const campaigns = await this.prisma.emailCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
    return {
      campaigns: campaigns.map((c) => ({
        id: c.id,
        subject: c.subject,
        audience: c.audience,
        targetUsername: c.targetUsername,
        queuedCount: c.queuedCount,
        createdByAdminId: c.createdByAdminId,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  async broadcast(input: {
    subject: string;
    body: string;
    audience: 'all' | 'user';
    username?: string;
    adminLogin: string;
    format?: 'plain' | 'html';
    imageUrl?: string;
    buttons?: MarketingButton[];
  }) {
    if (!this.email.smtpConfigured) {
      return { ok: false as const, campaignId: null, queuedCount: 0, reason: 'smtp_not_configured' };
    }

    const subject = input.subject.trim();
    const body = input.body.trim();
    const format = input.format === 'html' ? 'html' : 'plain';
    const imageUrl = this.resolvePublicMediaUrl(input.imageUrl);
    const buttons = (input.buttons ?? [])
      .filter((b) => b.text.trim() && /^https?:\/\//i.test(b.url.trim()))
      .slice(0, 6)
      .map((b) => ({ text: b.text.trim().slice(0, 64), url: b.url.trim() }));

    const recipients = await this.resolveRecipients(input.audience, input.username);

    if (recipients.length === 0) {
      return { ok: false as const, campaignId: null, queuedCount: 0, reason: 'no_recipients' };
    }

    if (input.audience === 'all' && recipients.length > MAX_ALL_RECIPIENTS) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
        reason: 'audience_too_large',
        eligibleUsers: recipients.length,
        max: MAX_ALL_RECIPIENTS,
      });
    }

    const reserve = await tryReserveMarketing(this.redis, recipients.length);
    if (!reserve.ok) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
        reason: 'audience_exceeds_quota',
        remainingToday: reserve.remainingToday,
        requested: recipients.length,
        sentToday: reserve.sentToday,
        reservedToday: reserve.reservedToday,
      });
    }

    const jobs: EmailJob<'marketing'>[] = recipients.map((r) => ({
      to: r.email,
      template: 'marketing',
      vars: {
        username: r.username ?? r.email.split('@')[0] ?? 'jogador',
        subject,
        body,
        format,
        imageUrl,
        buttons,
      },
    }));

    try {
      const campaign = await this.prisma.emailCampaign.create({
        data: {
          subject,
          body,
          audience: input.audience,
          targetUsername:
            input.audience === 'user' ? input.username!.trim().replace(/^@/, '') : null,
          queuedCount: 0,
          createdByAdminId: input.adminLogin,
        },
      });

      const queuedCount = await this.email.sendMany(jobs as EmailJob[]);

      if (queuedCount < recipients.length) {
        await releaseMarketingReservation(this.redis, recipients.length - queuedCount);
      }

      await this.prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { queuedCount },
      });

      return {
        ok: queuedCount > 0,
        campaignId: campaign.id,
        queuedCount,
      };
    } catch (err) {
      await releaseMarketingReservation(this.redis, recipients.length);
      throw err;
    }
  }

  private async resolveRecipients(
    audience: 'all' | 'user',
    username?: string,
  ): Promise<Array<{ email: string; username: string | null }>> {
    if (audience === 'user') {
      const clean = (username ?? '').trim().replace(/^@/, '');
      if (!clean) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'username_required' });
      }
      const user = await this.prisma.user.findFirst({
        where: {
          username: { equals: clean, mode: 'insensitive' },
          ...ELIGIBLE_WHERE,
        },
        select: { email: true, username: true },
      });
      if (!user?.email) {
        throw new AppError(ErrorCode.USER_NOT_FOUND, 404, {
          reason: 'email_not_verified',
        });
      }
      return [{ email: user.email, username: user.username }];
    }

    const users = await this.prisma.user.findMany({
      where: ELIGIBLE_WHERE,
      select: { email: true, username: true },
    });
    return users
      .filter((u): u is { email: string; username: string | null } => Boolean(u.email))
      .map((u) => ({ email: u.email, username: u.username }));
  }
}
