import { logger } from '../../common/lib/logger.js';
import { runWithSystemContext } from '../../common/lib/prisma-context.js';
import { config } from '../../config/env.js';
import type { TelegramService } from './telegram.service.js';

type TelegramUpdate = {
  update_id: number;
  message?: { text?: string; chat?: { id?: number | string } };
};

/**
 * Long-polling getUpdates — used when Cloudflare (or similar) blocks Telegram webhooks.
 * Deletes any existing webhook first; cannot run alongside an active webhook.
 */
export function startTelegramPoller(telegram: TelegramService): () => void {
  if (!config.TELEGRAM_ENABLED || !config.TELEGRAM_BOT_TOKEN) {
    return () => undefined;
  }
  if (config.TELEGRAM_UPDATES_MODE !== 'polling') {
    return () => undefined;
  }

  const token = config.TELEGRAM_BOT_TOKEN;
  const base = `https://api.telegram.org/bot${token}`;
  let stopped = false;
  let offset = 0;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  void (async () => {
    try {
      const del = await fetch(`${base}/deleteWebhook`, { method: 'POST' });
      const delBody = (await del.json().catch(() => ({}))) as { ok?: boolean };
      logger.info(
        { event: 'telegram.poller.delete_webhook', ok: delBody.ok === true },
        'Telegram webhook cleared for polling mode',
      );
    } catch (err) {
      logger.warn({ event: 'telegram.poller.delete_webhook_failed', err }, 'deleteWebhook failed');
    }

    logger.info({ event: 'telegram.poller.start' }, 'Telegram long-polling started');

    while (!stopped) {
      try {
        const url = new URL(`${base}/getUpdates`);
        url.searchParams.set('offset', String(offset));
        url.searchParams.set('timeout', '25');
        url.searchParams.set('allowed_updates', JSON.stringify(['message']));

        const res = await fetch(url, { method: 'GET' });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          result?: TelegramUpdate[];
          description?: string;
        };

        if (!res.ok || body.ok === false) {
          logger.warn(
            {
              event: 'telegram.poller.get_updates_failed',
              status: res.status,
              description: body.description,
            },
            'getUpdates failed',
          );
          await sleep(3000);
          continue;
        }

        for (const update of body.result ?? []) {
          offset = update.update_id + 1;
          try {
            await runWithSystemContext(() => telegram.handleUpdate(update));
          } catch (err) {
            logger.error(
              { event: 'telegram.poller.handle_failed', updateId: update.update_id, err },
              'Failed to handle Telegram update',
            );
          }
        }
      } catch (err) {
        if (stopped) break;
        logger.warn({ event: 'telegram.poller.loop_error', err }, 'Telegram poller error');
        await sleep(3000);
      }
    }

    logger.info({ event: 'telegram.poller.stop' }, 'Telegram long-polling stopped');
  })();

  return () => {
    stopped = true;
  };
}
