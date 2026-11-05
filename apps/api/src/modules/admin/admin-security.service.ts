import type { PrismaClient } from '@prisma/client';

// IPs que nunca devem ser flagados: loopback, redes privadas RFC1918, Docker bridge, link-local
const PRIVATE_IP_PREFIXES = [
  '127.',
  '::1',
  '10.',
  '192.168.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '169.254.',
  'fc', 'fd',
  '::ffff:',
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PREFIXES.some((prefix) => ip.startsWith(prefix));
}

export interface SecurityAlertDTO {
  userId: string;
  email: string | null;
  username: string | null;
  uniqueIps: number;
  lastIp: string;
  lastSeenAt: string;
  ips: string[];
}

export interface IpClusterDTO {
  ip: string;
  uniqueUsers: number;
  users: Array<{ userId: string; email: string | null; username: string | null }>;
}

export class AdminSecurityService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Usuários com mais de 1 IP público único — sinal de compartilhamento de conta. */
  async getMultiIpUsers(limit = 100): Promise<SecurityAlertDTO[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ userId: string; unique_ips: bigint; last_ip: string; last_seen: Date }>
    >`
      SELECT "userId", COUNT(DISTINCT ip)::bigint AS unique_ips,
        (SELECT ip FROM "UserIpEvent" e2 WHERE e2."userId" = e1."userId" ORDER BY "createdAt" DESC LIMIT 1) AS last_ip,
        MAX("createdAt") AS last_seen
      FROM "UserIpEvent" e1
      GROUP BY "userId"
      HAVING COUNT(DISTINCT ip) > 1
      ORDER BY unique_ips DESC, last_seen DESC
      LIMIT ${limit}
    `;

    if (rows.length === 0) return [];

    const userIds = rows.map((r) => r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, username: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const result: SecurityAlertDTO[] = [];
    for (const r of rows) {
      const allIps = await this.prisma.userIpEvent.findMany({
        where: { userId: r.userId },
        distinct: ['ip'],
        select: { ip: true },
      });
      const publicIps = allIps.map((x) => x.ip).filter((ip) => !isPrivateIp(ip));
      if (publicIps.length <= 1) continue; // apenas IPs privados — ignorar
      const u = userMap.get(r.userId);
      result.push({
        userId: r.userId,
        email: u?.email ?? null,
        username: u?.username ?? null,
        uniqueIps: publicIps.length,
        lastIp: isPrivateIp(r.last_ip) ? (publicIps[0] ?? r.last_ip) : r.last_ip,
        lastSeenAt: r.last_seen.toISOString(),
        ips: publicIps,
      });
    }
    return result;
  }

  /** IPs públicos compartilhados por mais de 1 usuário — sinal de multi-conta. */
  async getSharedIps(limit = 100): Promise<IpClusterDTO[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ ip: string; unique_users: bigint }>
    >`
      SELECT ip, COUNT(DISTINCT "userId")::bigint AS unique_users
      FROM "UserIpEvent"
      GROUP BY ip
      HAVING COUNT(DISTINCT "userId") > 1
      ORDER BY unique_users DESC
      LIMIT ${limit}
    `;

    if (rows.length === 0) return [];

    const result: IpClusterDTO[] = [];
    for (const r of rows) {
      if (isPrivateIp(r.ip)) continue; // ignorar IPs internos (Docker, loopback, RFC1918)
      const events = await this.prisma.userIpEvent.findMany({
        where: { ip: r.ip },
        distinct: ['userId'],
        select: { userId: true, user: { select: { email: true, username: true } } },
      });
      result.push({
        ip: r.ip,
        uniqueUsers: Number(r.unique_users),
        users: events.map((e) => ({
          userId: e.userId,
          email: e.user?.email ?? null,
          username: e.user?.username ?? null,
        })),
      });
    }
    return result;
  }
}
