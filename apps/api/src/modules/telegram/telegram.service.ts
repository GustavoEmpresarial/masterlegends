import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { TELEGRAM_QUEUE, type TelegramSendJob } from '@mll/shared';
import { asBullMqConnection } from '../../common/lib/redis-queue.js';
import { logger } from '../../common/lib/logger.js';
import { runWithSystemContext } from '../../common/lib/prisma-context.js';
import { config } from '../../config/env.js';
import {
  escapeTelegramHtml,
  formatTelegramHtml,
  msgAlreadyLinked,
  msgHelp,
  msgInvalidCode,
  msgLinkedSuccess,
  msgMuteToggled,
  msgNeedLink,
  msgStatus,
  msgWelcomeUnlinked,
  type InlineKeyboard,
} from './telegram.messages.js';

type TelegramInboundMessage = {
  message_id?: number;
  text?: string;
  chat?: { id?: number | string; type?: string };
  message_thread_id?: number;
  reply_to_message?: { from?: { is_bot?: boolean; username?: string }; text?: string };
  entities?: Array<{ type?: string; offset?: number; length?: number }>;
};

type TelegramUpdate = {
  message?: TelegramInboundMessage;
};

export type { InlineKeyboard } from './telegram.messages.js';
export {
  buildAdminBroadcast,
  msgAfflictionApplied,
  msgAfflictionBroadcastGlobal,
  msgAfflictionCut,
  msgAnnouncement,
  msgGlobalChannelIntro,
  msgSupportReplied,
  msgWithdrawalApproved,
  msgWithdrawalSatspay,
  msgWithdrawalProofGlobal,
  msgWithdrawalRejected,
  sanitizeTelegramHtml,
} from './telegram.messages.js';

const LINK_CODE_TTL_SEC = 10 * 60;
const LINK_CODE_PREFIX = 'telegram:link:';
const LINK_USER_PREFIX = 'telegram:link-user:';
const RATE_PREFIX = 'telegram:rl:';
const RATE_LIMIT_PER_MIN = 20;

export class TelegramService {
  private readonly queue: Queue<TelegramSendJob>;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    redisQueue: Redis,
  ) {
    this.queue = new Queue<TelegramSendJob>(TELEGRAM_QUEUE, {
      connection: asBullMqConnection(redisQueue),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    });
  }

  get enabled(): boolean {
    return config.TELEGRAM_ENABLED && Boolean(config.TELEGRAM_BOT_TOKEN);
  }

  get botUsername(): string {
    return config.TELEGRAM_BOT_USERNAME.replace(/^@/, '');
  }

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramChatId: true,
        telegramLinkedAt: true,
        telegramNotifyEnabled: true,
      },
    });
    return {
      enabled: this.enabled,
      botUsername: this.botUsername || null,
      linked: Boolean(user?.telegramChatId),
      linkedAt: user?.telegramLinkedAt?.toISOString() ?? null,
      notifyEnabled: user?.telegramNotifyEnabled ?? true,
    };
  }

  async getAdminStatus() {
    const linkedUsers = await this.prisma.user.count({
      where: {
        telegramChatId: { not: null },
        telegramNotifyEnabled: true,
      },
    });
    return {
      enabled: this.enabled,
      botUsername: this.botUsername || null,
      globalConfigured: Boolean(config.TELEGRAM_GLOBAL_CHAT_ID),
      globalThreadId: config.TELEGRAM_GLOBAL_THREAD_ID ?? null,
      linkedUsers,
    };
  }

  async listNotifyLinkedUserIds(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        telegramChatId: { not: null },
        telegramNotifyEnabled: true,
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  async findLinkedByUsername(username: string) {
    const clean = username.trim().replace(/^@/, '');
    if (!clean) return null;
    return this.prisma.user.findFirst({
      where: {
        username: { equals: clean, mode: 'insensitive' },
        telegramChatId: { not: null },
      },
      select: {
        id: true,
        username: true,
        telegramNotifyEnabled: true,
      },
    });
  }

  /** Creates a short-lived link code and deep-link URL for /start. */
  async createLinkCode(userId: string): Promise<{ code: string; deepLink: string | null; expiresInSec: number }> {
    if (!this.enabled) {
      return { code: '', deepLink: null, expiresInSec: LINK_CODE_TTL_SEC };
    }

    const prev = await this.redis.get(`${LINK_USER_PREFIX}${userId}`);
    if (prev) {
      await this.redis.del(`${LINK_CODE_PREFIX}${prev}`);
    }

    const code = Array.from({ length: 8 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 32)),
    ).join('');

    await this.redis.set(`${LINK_CODE_PREFIX}${code}`, userId, 'EX', LINK_CODE_TTL_SEC);
    await this.redis.set(`${LINK_USER_PREFIX}${userId}`, code, 'EX', LINK_CODE_TTL_SEC);

    const deepLink = this.botUsername
      ? `https://t.me/${this.botUsername}?start=${code}`
      : null;

    return { code, deepLink, expiresInSec: LINK_CODE_TTL_SEC };
  }

  async consumeLinkCode(
    code: string,
    chatId: string,
  ): Promise<{ ok: boolean; username?: string; alreadyLinked?: boolean }> {
    const userId = await this.redis.get(`${LINK_CODE_PREFIX}${code.toUpperCase()}`);
    if (!userId) {
      // Code gone — maybe already linked with this chat
      const existing = await this.prisma.user.findFirst({
        where: { telegramChatId: String(chatId) },
        select: { username: true },
      });
      if (existing) {
        return { ok: true, username: existing.username ?? undefined, alreadyLinked: true };
      }
      return { ok: false };
    }

    const sameUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true, username: true },
    });
    if (sameUser?.telegramChatId === String(chatId)) {
      await this.redis.del(`${LINK_CODE_PREFIX}${code.toUpperCase()}`);
      await this.redis.del(`${LINK_USER_PREFIX}${userId}`);
      return { ok: true, username: sameUser.username ?? undefined, alreadyLinked: true };
    }

    const other = await this.prisma.user.findFirst({
      where: { telegramChatId: String(chatId), NOT: { id: userId } },
      select: { id: true },
    });
    if (other) {
      await this.prisma.user.update({
        where: { id: other.id },
        data: { telegramChatId: null, telegramLinkedAt: null },
      });
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        telegramChatId: String(chatId),
        telegramLinkedAt: new Date(),
        telegramNotifyEnabled: true,
      },
      select: { username: true },
    });

    await this.redis.del(`${LINK_CODE_PREFIX}${code.toUpperCase()}`);
    await this.redis.del(`${LINK_USER_PREFIX}${userId}`);

    logger.info(
      { event: 'telegram.linked', userId, chatId, username: user.username },
      'Telegram account linked',
    );

    return { ok: true, username: user.username ?? undefined };
  }

  async unlink(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramChatId: null, telegramLinkedAt: null },
    });
    if (user?.telegramChatId) {
      try {
        await this.sendDirect(
          user.telegramChatId,
          formatTelegramHtml(
            'Conta desvinculada',
            'Este Telegram não recebe mais alertas do MLL. Vincule de novo em Configurações quando quiser.',
          ),
        );
      } catch {
        /* best-effort notice */
      }
    }
    return { ok: true as const };
  }

  async setNotifyEnabled(userId: string, enabled: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramNotifyEnabled: enabled },
    });
    return { ok: true as const, notifyEnabled: enabled };
  }

  async enqueueUser(
    userId: string,
    text: string,
    kind?: string,
    replyMarkup?: InlineKeyboard,
    media?: { photoUrl?: string; disableWebPagePreview?: boolean },
  ): Promise<boolean> {
    if (!this.enabled) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true, telegramNotifyEnabled: true },
    });
    if (!user?.telegramChatId || !user.telegramNotifyEnabled) return false;
    await this.enqueue({
      chatId: user.telegramChatId,
      text,
      parseMode: 'HTML',
      replyMarkup,
      photoUrl: media?.photoUrl,
      disableWebPagePreview: media?.disableWebPagePreview,
      userId,
      kind,
    });
    return true;
  }

  async enqueueGlobal(
    text: string,
    kind?: string,
    replyMarkup?: InlineKeyboard,
    media?: { photoUrl?: string; disableWebPagePreview?: boolean },
  ): Promise<boolean> {
    if (!this.enabled) return false;
    const chatId = config.TELEGRAM_GLOBAL_CHAT_ID;
    if (!chatId) {
      logger.warn({ event: 'telegram.global_missing' }, 'TELEGRAM_GLOBAL_CHAT_ID not set');
      return false;
    }
    const threadId = config.TELEGRAM_GLOBAL_THREAD_ID;
    await this.enqueue({
      chatId,
      text,
      parseMode: 'HTML',
      replyMarkup,
      photoUrl: media?.photoUrl,
      disableWebPagePreview: media?.disableWebPagePreview,
      messageThreadId: threadId,
      kind: kind ?? 'global',
    });
    return true;
  }

  async sendRaw(chatId: string, text: string, kind = 'raw', replyMarkup?: InlineKeyboard): Promise<void> {
    if (!this.enabled) return;
    await this.enqueue({ chatId, text, parseMode: 'HTML', replyMarkup, kind });
  }

  async sendDirect(
    chatId: string,
    text: string,
    replyMarkup?: InlineKeyboard,
    opts?: { replyToMessageId?: number; messageThreadId?: number },
  ): Promise<number | null> {
    if (!this.enabled || !config.TELEGRAM_BOT_TOKEN) return null;
    const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        ...(opts?.replyToMessageId
          ? { reply_to_message_id: opts.replyToMessageId, allow_sending_without_reply: true }
          : {}),
        ...(opts?.messageThreadId ? { message_thread_id: opts.messageThreadId } : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    if (!res.ok || body.ok === false) {
      throw new Error(body.description ?? `Telegram sendMessage HTTP ${res.status}`);
    }
    const id = body.result?.message_id;
    return typeof id === 'number' && id > 0 ? id : null;
  }

  /** Best-effort delete (ignores already-gone / too-old messages). */
  async deleteMessage(chatId: string, messageId: number): Promise<boolean> {
    if (!this.enabled || !config.TELEGRAM_BOT_TOKEN) return false;
    if (!Number.isFinite(messageId) || messageId <= 0) return false;
    try {
      const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/deleteMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
      if (body.ok === true) return true;
      logger.info(
        { event: 'telegram.delete_message.skip', chatId, messageId, err: body.description },
        'Telegram deleteMessage skipped',
      );
      return false;
    } catch (err) {
      logger.warn({ event: 'telegram.delete_message.failed', chatId, messageId, err }, 'deleteMessage failed');
      return false;
    }
  }

  private async allowChat(chatId: string): Promise<boolean> {
    const key = `${RATE_PREFIX}${chatId}`;
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, 60);
    return n <= RATE_LIMIT_PER_MIN;
  }

  private async findByChat(chatId: string) {
    return this.prisma.user.findFirst({
      where: { telegramChatId: String(chatId) },
      select: {
        id: true,
        username: true,
        telegramNotifyEnabled: true,
        telegramLinkedAt: true,
      },
    });
  }

  /** Handle inbound Telegram update (webhook or long-polling). */
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (!this.enabled) return;

    await runWithSystemContext(async () => {
      const msg = update.message;
      const raw = msg?.text?.trim() ?? '';
      const chatId = msg?.chat?.id;
      if (!raw || chatId === undefined) return;

      const chat = String(chatId);
      const chatType = msg?.chat?.type ?? 'private';
      const isPrivate = chatType === 'private';

      if (!(await this.allowChat(chat))) {
        logger.warn({ event: 'telegram.rate_limited', chatId: chat }, 'Telegram chat rate limited');
        return;
      }

      const [cmdToken, ...rest] = raw.split(/\s+/);
      const cmd = (cmdToken ?? '').split('@')[0]?.toLowerCase() ?? '';
      const arg = rest.join(' ').trim();

      if (cmd === '/start') {
        await this.handleStart(chat, arg);
        return;
      }
      if (cmd === '/help') {
        const user = await this.findByChat(chat);
        const help = msgHelp(Boolean(user));
        await this.sendDirect(chat, help.text, help.replyMarkup);
        return;
      }
      if (cmd === '/status') {
        const user = await this.findByChat(chat);
        if (!user) {
          const need = msgNeedLink();
          await this.sendDirect(chat, need.text, need.replyMarkup);
          return;
        }
        const status = msgStatus({
          linked: true,
          username: user.username,
          notifyEnabled: user.telegramNotifyEnabled,
          linkedAt: user.telegramLinkedAt,
        });
        await this.sendDirect(chat, status.text, status.replyMarkup);
        return;
      }
      if (cmd === '/mute' || cmd === '/unmute') {
        const user = await this.findByChat(chat);
        if (!user) {
          const need = msgNeedLink();
          await this.sendDirect(chat, need.text, need.replyMarkup);
          return;
        }
        const enabled = cmd === '/unmute';
        await this.prisma.user.update({
          where: { id: user.id },
          data: { telegramNotifyEnabled: enabled },
        });
        const muted = msgMuteToggled(enabled);
        await this.sendDirect(chat, muted.text, muted.replyMarkup);
        return;
      }
      if (cmd === '/ping') {
        await this.sendDirect(
          chat,
          `⚡️ <b>MLL · GENESIS DAO</b>\n<code>pong · ${new Date().toISOString()}</code>`,
        );
        return;
      }
      // Unknown private command tip
      if (isPrivate) {
        const user = await this.findByChat(chat);
        if (user) {
          await this.sendDirect(
            chat,
            formatTelegramHtml('Comando não reconhecido', 'Use /help para ver os comandos disponíveis.'),
          );
        }
      }
    });
  }

  private async handleStart(chatId: string, codeRaw: string): Promise<void> {
    const code = codeRaw.toUpperCase();
    if (!code) {
      const linked = await this.findByChat(chatId);
      if (linked) {
        const msg = msgAlreadyLinked(linked.username ?? undefined);
        await this.sendDirect(chatId, msg.text, msg.replyMarkup);
        return;
      }
      const msg = msgWelcomeUnlinked();
      await this.sendDirect(chatId, msg.text, msg.replyMarkup);
      return;
    }

    const result = await this.consumeLinkCode(code, chatId);
    if (!result.ok) {
      const msg = msgInvalidCode();
      await this.sendDirect(chatId, msg.text, msg.replyMarkup);
      return;
    }

    const msg = result.alreadyLinked
      ? msgAlreadyLinked(result.username)
      : msgLinkedSuccess(result.username);
    await this.sendDirect(chatId, msg.text, msg.replyMarkup);
  }

  async enqueueManyUsers(
    userIds: string[],
    text: string,
    kind?: string,
    replyMarkup?: InlineKeyboard,
    media?: { photoUrl?: string; disableWebPagePreview?: boolean },
  ): Promise<number> {
    if (!this.enabled || userIds.length === 0) return 0;
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        telegramChatId: { not: null },
        telegramNotifyEnabled: true,
      },
      select: { id: true, telegramChatId: true },
    });
    await Promise.all(
      users.map((u) =>
        u.telegramChatId
          ? this.enqueue({
              chatId: u.telegramChatId,
              text,
              parseMode: 'HTML',
              replyMarkup,
              photoUrl: media?.photoUrl,
              disableWebPagePreview: media?.disableWebPagePreview,
              userId: u.id,
              kind,
            })
          : Promise.resolve(),
      ),
    );
    return users.length;
  }

  /** Turn relative /uploads/... into absolute URL Telegram can fetch. */
  resolvePublicMediaUrl(url: string | undefined | null): string | undefined {
    if (!url?.trim()) return undefined;
    const u = url.trim();
    if (/^https?:\/\//i.test(u)) return u;
    const base = (config.WEB_URL || '').replace(/\/$/, '');
    if (!base) return u.startsWith('/') ? u : `/${u}`;
    return `${base}${u.startsWith('/') ? u : `/${u}`}`;
  }

  private async enqueue(job: TelegramSendJob): Promise<void> {
    logger.info(
      { event: 'telegram.enqueue', chatId: job.chatId, userId: job.userId, kind: job.kind },
      'Telegram queued',
    );
    await this.queue.add(job.kind ?? 'send', job);
  }
}

export { formatTelegramHtml, escapeTelegramHtml };

/** Shared factory for admin + event hooks. */
export function createTelegramService(app: FastifyInstance): TelegramService {
  return new TelegramService(app.prisma, app.redis, app.redisQueue);
}
