import { UnrecoverableError, Worker } from 'bullmq';
import type Redis from 'ioredis';
import {
  EMAIL_QUEUE,
  renderEmailTemplate,
  type EmailJob,
  type EmailTemplateId,
} from '@mll/shared';
import { getSmtpTransport } from '../modules/email/transports/smtp.js';
import {
  assertMarketingSendAllowed,
  recordMarketingSent,
  releaseMarketingReservation,
} from '../modules/email/email-marketing-quota.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/env.js';

export { EMAIL_QUEUE } from '@mll/shared';

function isMarketingJob(job: { data?: EmailJob } | undefined): boolean {
  return job?.data?.template === 'marketing';
}

export function startEmailWorker(redis: Redis): Worker<EmailJob> {
  const worker = new Worker<EmailJob>(
    EMAIL_QUEUE,
    async (job) => {
      const { to, template, vars } = job.data;

      if (template === 'marketing') {
        await assertMarketingSendAllowed(redis);
      }

      const content = renderEmailTemplate(template as EmailTemplateId, vars);

      const transport = getSmtpTransport();
      const info = await transport.sendMail({
        from: config.SMTP_FROM,
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });

      if (template === 'marketing') {
        await recordMarketingSent(redis);
      }

      logger.info(
        { event: 'email.sent', template, messageId: info.messageId, jobId: job.id },
        'Email delivered',
      );
    },
    { connection: redis, concurrency: 2 },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { event: 'email.failed', jobId: job?.id, template: job?.name, err: err.message },
      'Email job failed',
    );

    if (!isMarketingJob(job)) return;

    const maxAttempts = job?.opts.attempts ?? 3;
    const attemptsMade = job?.attemptsMade ?? 0;
    const unrecoverable =
      err instanceof UnrecoverableError ||
      err.name === 'UnrecoverableError' ||
      err.message === 'marketing_daily_quota_exhausted';

    if (unrecoverable || attemptsMade >= maxAttempts) {
      void releaseMarketingReservation(redis, 1).catch((releaseErr: unknown) => {
        logger.error(
          {
            event: 'email.marketing_release_failed',
            jobId: job?.id,
            err: releaseErr instanceof Error ? releaseErr.message : String(releaseErr),
          },
          'Failed to release marketing reservation',
        );
      });
    }
  });

  return worker;
}
