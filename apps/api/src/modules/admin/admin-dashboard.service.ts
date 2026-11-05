import type { PrismaClient } from '@prisma/client';

export class AdminDashboardService {
  constructor(private readonly prisma: PrismaClient) {}

  async listUsers(limit: number, cursor?: string) {
    const users = await this.prisma.user.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerifiedAt: true,
        failedLoginCount: true,
        lockedUntil: true,
        createdAt: true,
      },
    });

    const hasMore = users.length > limit;
    const items = hasMore ? users.slice(0, limit) : users;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    return { users: items, nextCursor };
  }

  async listAuditLogs(limit: number, cursor?: string) {
    const logs = await this.prisma.auditLog.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        action: true,
        severity: true,
        ip: true,
        meta: true,
        createdAt: true,
      },
    });

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    return { logs: items, nextCursor };
  }
}
