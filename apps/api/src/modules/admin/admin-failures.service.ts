import { MongoClient, type Db, type Filter } from 'mongodb';
import { config } from '../../config/env.js';

export interface FailureFilters {
  kind?: string;
  reason?: string;
  userId?: string;
  surface?: string;
  route?: string;
  area?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface FailureEntryDTO {
  id: string;
  ts: string;
  kind: string;
  reason: string;
  surface: string | null;
  route: string | null;
  area: string | null;
  tab: string | null;
  userId: string | null;
  adminLogin: string | null;
  ip: string | null;
  userAgent: string | null;
  message: string | null;
  context: Record<string, unknown> | null;
}

export interface FailureSummaryDTO {
  total: number;
  byKind: { kind: string; count: number }[];
  byReason: { kind: string; reason: string; count: number }[];
  byRoute: { route: string; count: number }[];
  byArea: { area: string; count: number }[];
  topUsers: { userId: string; count: number }[];
  hourly: { hour: string; count: number }[];
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

function buildWhere(filters: FailureFilters): Filter<Record<string, unknown>> {
  const where: Filter<Record<string, unknown>> = { event: 'user_failure' };
  if (filters.kind) where.kind = filters.kind;
  if (filters.reason) where.reason = filters.reason;
  if (filters.userId) where.userId = filters.userId;
  if (filters.surface) where.surface = filters.surface;
  if (filters.route) where.route = { $regex: filters.route, $options: 'i' };
  if (filters.area) where.area = filters.area;
  if (filters.from || filters.to) {
    const ts: Record<string, Date> = {};
    if (filters.from) ts.$gte = new Date(filters.from);
    if (filters.to) ts.$lte = new Date(filters.to);
    where.ts = ts;
  }
  return where;
}

export async function listFailures(filters: FailureFilters): Promise<{
  items: FailureEntryDTO[];
  total: number;
}> {
  const database = await getDb();
  const col = database.collection('logs');
  const where = buildWhere(filters);
  const limit = Math.min(500, Math.max(1, filters.limit ?? 100));

  const [rows, total] = await Promise.all([
    col.find(where).sort({ ts: -1 }).limit(limit).toArray(),
    col.countDocuments(where),
  ]);

  const items: FailureEntryDTO[] = rows.map((r) => ({
    id: String(r._id),
    ts: r.ts instanceof Date ? r.ts.toISOString() : new Date(r.ts as string).toISOString(),
    kind: String(r.kind ?? 'other'),
    reason: String(r.reason ?? 'unknown'),
    surface: r.surface ? String(r.surface) : null,
    route: r.route ? String(r.route) : null,
    area: r.area ? String(r.area) : null,
    tab: r.tab ? String(r.tab) : null,
    userId: r.userId ? String(r.userId) : null,
    adminLogin: r.adminLogin ? String(r.adminLogin) : null,
    ip: r.ip ? String(r.ip) : null,
    userAgent: r.userAgent ? String(r.userAgent) : null,
    message: r.message ? String(r.message) : null,
    context: (r.context as Record<string, unknown>) ?? null,
  }));

  return { items, total };
}

export async function summarizeFailures(
  filters: Pick<FailureFilters, 'from' | 'to' | 'surface' | 'area'> = {},
): Promise<FailureSummaryDTO> {
  const database = await getDb();
  const col = database.collection('logs');
  const where = buildWhere(filters);

  const [total, byKindAgg, byReasonAgg, byRouteAgg, byAreaAgg, topUsersAgg, hourlyAgg] =
    await Promise.all([
      col.countDocuments(where),
      col.aggregate([
        { $match: where },
        { $group: { _id: '$kind', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray(),
      col.aggregate([
        { $match: where },
        { $group: { _id: { kind: '$kind', reason: '$reason' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]).toArray(),
      col.aggregate([
        { $match: { ...where, route: { $nin: [null, ''] } } },
        { $group: { _id: '$route', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]).toArray(),
      col.aggregate([
        { $match: { ...where, area: { $nin: [null, ''] } } },
        { $group: { _id: '$area', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]).toArray(),
      col.aggregate([
        { $match: { ...where, userId: { $nin: [null, ''] } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]).toArray(),
      col.aggregate([
        { $match: where },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%dT%H:00:00Z', date: '$ts' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 168 },
      ]).toArray(),
    ]);

  return {
    total,
    byKind: byKindAgg.map((r) => ({ kind: String(r._id ?? 'unknown'), count: r.count })),
    byReason: byReasonAgg.map((r) => ({
      kind: String((r._id as { kind?: string })?.kind ?? 'unknown'),
      reason: String((r._id as { reason?: string })?.reason ?? 'unknown'),
      count: r.count,
    })),
    byRoute: byRouteAgg.map((r) => ({ route: String(r._id), count: r.count })),
    byArea: byAreaAgg.map((r) => ({ area: String(r._id), count: r.count })),
    topUsers: topUsersAgg.map((r) => ({ userId: String(r._id), count: r.count })),
    hourly: hourlyAgg.map((r) => ({ hour: String(r._id), count: r.count })),
  };
}
