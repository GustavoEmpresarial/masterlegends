import { describe, it, expect, vi, beforeEach } from 'vitest';

const add = vi.fn().mockResolvedValue({ id: 'job-1' });

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ add })),
}));

import { EmailService } from '../../../src/modules/email/email.service.js';

describe('EmailService', () => {
  beforeEach(() => {
    add.mockClear();
  });

  it('enqueues email job', async () => {
    const service = new EmailService({} as any);
    await service.send({
      to: 'a@b.com',
      template: 'verify-email',
      vars: { username: 'a', link: 'http://x' },
    });
    expect(add).toHaveBeenCalledWith(
      'verify-email',
      expect.objectContaining({ to: 'a@b.com', template: 'verify-email' }),
    );
  });
});
