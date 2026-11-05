import { Worker } from 'bullmq';
import type Redis from 'ioredis';
import { TELEGRAM_QUEUE, type TelegramSendJob } from '@mll/shared';
import { logger } from '../lib/logger.js';
import { config } from '../config/env.js';

export { TELEGRAM_QUEUE } from '@mll/shared';

async function telegramApi(
  method: 'sendMessage' | 'sendPhoto',
  payload: Record<string, unknown>,
): Promise<void> {
  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
  };
  if (!res.ok || body.ok === false) {
    const desc = body.description ?? `HTTP ${res.status}`;
    throw new Error(`Telegram ${method} failed: ${desc}`);
  }
}

export function startTelegramWorker(redis: Redis): Worker<TelegramSendJob> {
  const worker = new Worker<TelegramSendJob>(
    TELEGRAM_QUEUE,
    async (job) => {
      if (!config.TELEGRAM_ENABLED || !config.TELEGRAM_BOT_TOKEN) {
        logger.warn({ event: 'telegram.skipped', jobId: job.id }, 'Telegram disabled — skip send');
        return;
      }

      const {
        chatId,
        text,
        parseMode,
        replyMarkup,
        messageThreadId,
        photoUrl,
        disableWebPagePreview,
      } = job.data;

      const common = {
        chat_id: chatId,
        parse_mode: parseMode ?? 'HTML',
        ...(messageThreadId ? { message_thread_id: messageThreadId } : {}),
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      };

      if (photoUrl) {
        // Caption limit on Telegram is 1024 chars
        const caption = text.length > 1024 ? `${text.slice(0, 1020)}…` : text;
        await telegramApi('sendPhoto', {
          ...common,
          photo: photoUrl,
          caption,
        });
      } else {
        await telegramApi('sendMessage', {
          ...common,
          text,
          disable_web_page_preview: disableWebPagePreview !== false,
        });
      }

      logger.info(
        {
          event: 'telegram.sent',
          chatId,
          kind: job.data.kind,
          jobId: job.id,
          hasPhoto: Boolean(photoUrl),
        },
        'Telegram delivered',
      );
    },
    { connection: redis, concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { event: 'telegram.failed', jobId: job?.id, kind: job?.name, err: err.message },
      'Telegram job failed',
    );
  });

  return worker;
}
