import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMail = vi.fn().mockResolvedValue({ messageId: 'mid-1' });

vi.mock('../../../src/modules/email/transports/smtp.js', () => ({
  getSmtpTransport: () => ({ sendMail }),
}));

vi.mock('../../../src/config/env.js', () => ({
  config: { SMTP_FROM: 'test@mll.dev' },
}));

vi.mock('../../../src/lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { Worker } from 'bullmq';
import Redis from 'ioredis-mock';
import { startEmailWorker } from '../../../src/workers/email.worker.js';

describe('startEmailWorker', () => {
  let redis: InstanceType<typeof Redis>;

  beforeEach(async () => {
    sendMail.mockClear();
    redis = new Redis();
  });

  it('returns a BullMQ worker', async () => {
    const worker = startEmailWorker(redis as any);
    expect(worker).toBeInstanceOf(Worker);
    worker.emit('failed', { id: '1', name: 'verify-email' }, new Error('smtp down'));
    await worker.close();
  });
});
