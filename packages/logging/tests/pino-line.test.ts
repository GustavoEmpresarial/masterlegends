import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Writable } from 'node:stream';
import { MongoLogSink } from '../src/mongo-sink.js';

const insertMany = vi.fn().mockResolvedValue({});

vi.mock('mongodb', () => ({
  MongoClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    db: () => ({
      collection: () => ({
        createIndex: vi.fn().mockResolvedValue('ok'),
        insertMany,
      }),
    }),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('pino line parsing branches', () => {
  beforeEach(() => {
    insertMany.mockClear();
  });

  it('maps optional string fields from pino payload', async () => {
    const sink = new MongoLogSink({
      uri: 'mongodb://localhost:27017/test',
      ttlDays: 1,
      batchSize: 1,
      flushMs: 60_000,
      service: 'api',
    });
    await sink.connect();
    const stream = sink.createStream() as Writable;

    await new Promise<void>((resolve, reject) => {
      stream.write(
        JSON.stringify({
          level: 30,
          time: Date.now(),
          msg: 'hello',
          event: 'auth.login',
          userId: 'u1',
          jobId: 'j1',
          extra: 1,
        }),
        (err) => (err ? reject(err) : resolve()),
      );
    });

    await sink.flush();
    const doc = insertMany.mock.calls[0][0][0];
    expect(doc.event).toBe('auth.login');
    expect(doc.userId).toBe('u1');
    expect(doc.jobId).toBe('j1');
    await sink.close();
  });

  it('skips reconnect when already connected', async () => {
    const sink = new MongoLogSink({
      uri: 'mongodb://localhost:27017/test',
      ttlDays: 1,
      batchSize: 10,
      flushMs: 60_000,
      service: 'api',
    });
    await sink.connect();
    await sink.connect();
    await sink.close();
  });
});
