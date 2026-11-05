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

describe('MongoLogSink', () => {
  beforeEach(() => {
    insertMany.mockClear();
  });

  it('buffers and flushes on batch size', async () => {
    const sink = new MongoLogSink({
      uri: 'mongodb://localhost:27017/test',
      ttlDays: 1,
      batchSize: 2,
      flushMs: 60_000,
      service: 'api',
    });
    await sink.connect();

    sink.enqueue({
      ts: new Date(),
      level: 'info',
      service: 'api',
      msg: 'one',
      meta: {},
    });
    sink.enqueue({
      ts: new Date(),
      level: 'info',
      service: 'api',
      msg: 'two',
      meta: {},
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(insertMany).toHaveBeenCalledTimes(1);
    await sink.close();
  });

  it('drops batch when insertMany fails', async () => {
    insertMany.mockRejectedValueOnce(new Error('db down'));
    const sink = new MongoLogSink({
      uri: 'mongodb://localhost:27017/test',
      ttlDays: 1,
      batchSize: 1,
      flushMs: 60_000,
      service: 'api',
    });
    await sink.connect();
    sink.enqueue({
      ts: new Date(),
      level: 'info',
      service: 'api',
      msg: 'one',
      meta: {},
    });
    await sink.flush();
    expect(insertMany).toHaveBeenCalled();
    await sink.close();
  });

  it('ignores malformed stream lines', async () => {
    const sink = new MongoLogSink({
      uri: 'mongodb://localhost:27017/test',
      ttlDays: 1,
      batchSize: 1,
      flushMs: 60_000,
      service: 'api',
    });
    await sink.connect();
    const stream = sink.createStream() as Writable;
    await new Promise<void>((resolve) => {
      stream.write('not-json', () => resolve());
    });
    await sink.close();
  });

  it('parses pino lines from stream', async () => {
    const sink = new MongoLogSink({
      uri: 'mongodb://localhost:27017/test',
      ttlDays: 1,
      batchSize: 1,
      flushMs: 60_000,
      service: 'worker',
    });
    await sink.connect();
    const stream = sink.createStream() as Writable;

    await new Promise<void>((resolve, reject) => {
      stream.write(
        JSON.stringify({ level: 30, time: Date.now(), msg: 'hello', event: 'test.event' }),
        (err) => (err ? reject(err) : resolve()),
      );
    });

    await sink.flush();
    expect(insertMany).toHaveBeenCalled();
    await sink.close();
  });
});
