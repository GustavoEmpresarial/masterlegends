import crypto from 'node:crypto';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { EMAIL_QUEUE, type EmailJob, type EmailTemplateId } from '@mll/shared';
import { asBullMqConnection } from '../../common/lib/redis-queue.js';
import { logger } from '../../common/lib/logger.js';
import { config } from '../../config/env.js';

export { EMAIL_QUEUE } from '@mll/shared';
export type { EmailJob, EmailTemplateId, EmailTemplateVars } from '@mll/shared';

const BULK_BATCH = 100;

function hashRecipient(to: string): string {
  return crypto.createHash('sha256').update(to.toLowerCase()).digest('hex').slice(0, 16);
}

export class EmailService {
  private readonly queue: Queue<EmailJob>;

  constructor(redis: Redis) {
    this.queue = new Queue<EmailJob>(EMAIL_QUEUE, {
      connection: asBullMqConnection(redis),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    });
  }

  get smtpConfigured(): boolean {
    return Boolean(config.SMTP_HOST?.trim() && config.SMTP_FROM?.trim());
  }

  get smtpFrom(): string {
    return config.SMTP_FROM;
  }

  async send<K extends EmailTemplateId>(job: EmailJob<K>): Promise<void> {
    logger.info(
      { event: 'email.enqueue', recipientHash: hashRecipient(job.to), template: job.template },
      'Email queued',
    );
    await this.queue.add(job.template, job as EmailJob);
  }

  /** Enqueue many jobs in batches of 100. Returns number queued. */
  async sendMany(jobs: EmailJob[]): Promise<number> {
    if (jobs.length === 0) return 0;
    let queued = 0;
    for (let i = 0; i < jobs.length; i += BULK_BATCH) {
      const slice = jobs.slice(i, i + BULK_BATCH);
      await this.queue.addBulk(
        slice.map((job) => ({
          name: job.template,
          data: job,
        })),
      );
      queued += slice.length;
      logger.info(
        { event: 'email.enqueue_bulk', count: slice.length, offset: i },
        'Email bulk queued',
      );
    }
    return queued;
  }

  getQueue(): Queue<EmailJob> {
    return this.queue;
  }
}
