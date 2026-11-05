import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const connect = vi.fn().mockResolvedValue(undefined);
const createStream = vi.fn().mockReturnValue({ write: vi.fn() });
const close = vi.fn().mockResolvedValue(undefined);

vi.mock('../src/mongo-sink.js', () => ({
  MongoLogSink: vi.fn().mockImplementation(() => ({
    connect,
    createStream,
    close,
  })),
}));

import { createLogger, createFastifyLoggerOptions, closeMongoSink } from '../src/index.js';

describe('createLogger with mongo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await closeMongoSink();
  });

  it('attaches mongo stream when enabled', async () => {
    const logger = createLogger({
      service: 'worker',
      level: 'silent',
      mongo: { enabled: true, uri: 'mongodb://localhost:27017/logs' },
    });
    expect(logger).toBeTruthy();
    expect(connect).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
  });

  it('continues with stdout when mongo connect fails', async () => {
    connect.mockRejectedValueOnce(new Error('mongo down'));
    const logger = createLogger({
      service: 'worker',
      level: 'silent',
      mongo: { enabled: true, uri: 'mongodb://localhost:27017/logs' },
    });
    expect(logger).toBeTruthy();
    await new Promise((r) => setTimeout(r, 0));
  });

  it('uses multistream when mongo enabled', () => {
    const logger = createLogger({
      service: 'api',
      level: 'silent',
      isProduction: true,
      mongo: { enabled: true, uri: 'mongodb://localhost:27017/logs' },
    });
    expect(logger).toBeTruthy();
  });

  it('exposes fastify logger options', () => {
    const opts = createFastifyLoggerOptions({ service: 'api', level: 'info' });
    expect(opts.level).toBe('info');
    expect(opts.base).toEqual({ service: 'api' });
  });
});
