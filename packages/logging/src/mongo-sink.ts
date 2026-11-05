import { Writable } from 'node:stream';
import { MongoClient, type Db } from 'mongodb';

export interface MongoSinkOptions {
  uri: string;
  ttlDays: number;
  batchSize: number;
  flushMs: number;
  service: string;
}

interface LogDocument {
  ts: Date;
  level: string;
  service: string;
  event?: string;
  msg?: string;
  userId?: string;
  jobId?: string;
  meta: Record<string, unknown>;
}

function pinoLineToDoc(line: Record<string, unknown>, service: string): LogDocument {
  const { level, msg, time, event, userId, jobId, service: _svc, ...rest } = line;
  return {
    ts: new Date(typeof time === 'number' ? time : Date.now()),
    level: String(level ?? 'info'),
    service,
    event: typeof event === 'string' ? event : undefined,
    msg: typeof msg === 'string' ? msg : undefined,
    userId: typeof userId === 'string' ? userId : undefined,
    jobId: typeof jobId === 'string' ? jobId : undefined,
    meta: rest,
  };
}

export class MongoLogSink {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private buffer: LogDocument[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private indexesReady = false;

  constructor(private readonly options: MongoSinkOptions) {}

  async connect(): Promise<void> {
    if (this.client) return;

    this.client = new MongoClient(this.options.uri);
    await this.client.connect();
    this.db = this.client.db();

    await this.ensureIndexes();
    this.flushTimer = setInterval(() => void this.flush(), this.options.flushMs);
  }

  private async ensureIndexes(): Promise<void> {
    if (!this.db || this.indexesReady) return;

    const col = this.db.collection('logs');

    if (this.options.ttlDays > 0) {
      const ttlSeconds = this.options.ttlDays * 24 * 60 * 60;
      await col.createIndex({ ts: 1 }, { expireAfterSeconds: ttlSeconds });
    } else {
      // ttlDays = 0 → retenção infinita; índice simples sem TTL
      await col.createIndex({ ts: 1 });
    }
    await col.createIndex({ service: 1, event: 1, ts: -1 });
    await col.createIndex({ userId: 1, ts: -1 }, { sparse: true });

    this.indexesReady = true;
  }

  enqueue(doc: LogDocument): void {
    this.buffer.push(doc);
    if (this.buffer.length >= this.options.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this.db || this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await this.db.collection('logs').insertMany(batch, { ordered: false });
    } catch {
      // Drop batch on persistent failure — stdout still has the lines.
    }
  }

  createStream(): Writable {
    const service = this.options.service;
    return new Writable({
      write: (chunk, _enc, cb) => {
        try {
          const line = JSON.parse(chunk.toString()) as Record<string, unknown>;
          this.enqueue(pinoLineToDoc(line, service));
        } catch {
          /* ignore malformed lines */
        }
        cb();
      },
    });
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }
}
