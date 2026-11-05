import pino, { type Level, type Logger, type LoggerOptions } from 'pino';
import { MongoLogSink, type MongoSinkOptions } from './mongo-sink.js';

export type LogService = 'api' | 'worker';

export interface CreateLoggerOptions {
  service: LogService;
  level?: string;
  isProduction?: boolean;
  mongo?: Partial<MongoSinkOptions> & { enabled?: boolean };
}

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.refreshToken',
  '*.refresh_token',
];

let activeMongoSink: MongoLogSink | null = null;

export function createLogger(options: CreateLoggerOptions): Logger {
  const level = options.level ?? 'info';
  const base: LoggerOptions = {
    level,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    base: { service: options.service },
  };

  const streams: pino.StreamEntry[] = [{ stream: process.stdout }];

  if (options.mongo?.enabled && options.mongo.uri) {
    const sink = new MongoLogSink({
      uri: options.mongo.uri,
      ttlDays: options.mongo.ttlDays ?? 90,
      batchSize: options.mongo.batchSize ?? 100,
      flushMs: options.mongo.flushMs ?? 2000,
      service: options.service,
    });
    activeMongoSink = sink;
    void sink.connect().catch(() => {
      /* Mongo unavailable — stdout only */
    });
    streams.push({ stream: sink.createStream(), level: level as Level });
  }

  if (streams.length === 1) {
    return pino(
      options.isProduction
        ? base
        : {
            ...base,
            transport: { target: 'pino/file', options: { destination: 1 } },
          },
    );
  }

  return pino(base, pino.multistream(streams));
}

export function createFastifyLoggerOptions(options: CreateLoggerOptions): LoggerOptions {
  return {
    level: options.level ?? 'info',
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    base: { service: options.service },
  };
}

export async function closeMongoSink(): Promise<void> {
  if (activeMongoSink) {
    await activeMongoSink.close();
    activeMongoSink = null;
  }
}

export { MongoLogSink };
