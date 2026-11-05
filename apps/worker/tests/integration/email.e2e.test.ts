import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { isIntegrationEnabled } from '../helpers/integration-env.js';

const sendMail = vi.fn().mockResolvedValue({ messageId: 'test-id' });

vi.mock('../../src/modules/email/transports/smtp.js', () => ({
  getSmtpTransport: () => ({ sendMail }),
}));

const run = isIntegrationEnabled() ? describe : describe.skip;

run('email worker e2e', () => {
  let redis: Redis;
  let worker: Worker;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
    const { startEmailWorker } = await import('../../src/workers/email.worker.js');
    worker = startEmailWorker(redis);
    await worker.waitUntilReady();
  });

  afterAll(async () => {
    await worker.close();
    await redis.quit();
  });

  beforeEach(async () => {
    sendMail.mockClear();
    await redis.flushdb();
  });

  it('processes email job from queue', async () => {
    const queue = new Queue('email', { connection: redis });
    const job = await queue.add('verify-email', {
      to: 'test@example.com',
      template: 'verify-email',
      vars: { username: 'tester', link: 'http://localhost/v' },
    });

    await vi.waitFor(
      async () => {
        expect(await job.getState()).toBe('completed');
      },
      { timeout: 10_000 },
    );

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@example.com' }),
    );
    await queue.close();
  });
});
