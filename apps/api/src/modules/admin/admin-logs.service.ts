import { MongoClient, type Db, type Filter } from 'mongodb';
import { config } from '../../config/env.js';

export interface LogFilters {
  level?: string;
  service?: string;
  q?: string;
  from?: string; // ISO
  to?: string;   // ISO
  limit?: number;
}

export interface LogEntryDTO {
  id: string;
  ts: string;
  level: string;
  service: string;
  event: string | null;
  msg: string | null;
  userId: string | null;
  jobId: string | null;
  meta: Record<string, unknown>;
}

let client: MongoClient | null = null;
let db: Db | null = null;

async function getDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(config.MONGODB_URI);
  await client.connect();
  db = client.db();
  return db;
}

export async function queryLogs(filters: LogFilters): Promise<{
  logs: LogEntryDTO[];
  total: number;
}> {
  const database = await getDb();
  const col = database.collection('logs');

  const where: Filter<Record<string, unknown>> = {};
  if (filters.level) where.level = filters.level;
  if (filters.service) where.service = filters.service;
  if (filters.q) {
    where.$or = [
      { msg: { $regex: filters.q, $options: 'i' } },
      { event: { $regex: filters.q, $options: 'i' } },
    ];
  }
  if (filters.from || filters.to) {
    const ts: Record<string, Date> = {};
    if (filters.from) ts.$gte = new Date(filters.from);
    if (filters.to) ts.$lte = new Date(filters.to);
    where.ts = ts;
  }

  const limit = Math.min(500, Math.max(1, filters.limit ?? 100));
  const [rows, total] = await Promise.all([
    col.find(where).sort({ ts: -1 }).limit(limit).toArray(),
    col.countDocuments(where),
  ]);

  const logs: LogEntryDTO[] = rows.map((r) => ({
    id: String(r._id),
    ts: r.ts instanceof Date ? r.ts.toISOString() : new Date(r.ts as string).toISOString(),
    level: String(r.level ?? 'info'),
    service: String(r.service ?? ''),
    event: r.event ? String(r.event) : null,
    msg: r.msg ? String(r.msg) : null,
    userId: r.userId ? String(r.userId) : null,
    jobId: r.jobId ? String(r.jobId) : null,
    meta: (r.meta as Record<string, unknown>) ?? {},
  }));

  return { logs, total };
}

export async function getLogStats(): Promise<{
  total: number;
  byLevel: Record<string, number>;
  byService: Record<string, number>;
}> {
  const database = await getDb();
  const col = database.collection('logs');

  const [total, byLevelAgg, byServiceAgg] = await Promise.all([
    col.countDocuments({}),
    col
      .aggregate([{ $group: { _id: '$level', count: { $sum: 1 } } }])
      .toArray(),
    col
      .aggregate([{ $group: { _id: '$service', count: { $sum: 1 } } }])
      .toArray(),
  ]);

  const byLevel: Record<string, number> = {};
  for (const r of byLevelAgg) byLevel[String(r._id ?? 'unknown')] = r.count;
  const byService: Record<string, number> = {};
  for (const r of byServiceAgg) byService[String(r._id ?? 'unknown')] = r.count;

  return { total, byLevel, byService };
}
