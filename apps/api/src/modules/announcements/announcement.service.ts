import type { PrismaClient } from '@prisma/client';
import type { SiteAnnouncementDTO } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';

function mapAnnouncement(row: {
  id: string;
  title: string;
  body: string;
  active: boolean;
  dismissible: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): SiteAnnouncementDTO {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    active: row.active,
    dismissible: row.dismissible,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class AnnouncementService {
  constructor(private readonly prisma: PrismaClient) {}

  async list() {
    const rows = await this.prisma.siteAnnouncement.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { dismissals: true } } },
    });
    return rows.map((row) => ({
      ...mapAnnouncement(row),
      dismissalsCount: row._count.dismissals,
    }));
  }

  async create(
    data: {
      title: string;
      body: string;
      active: boolean;
      dismissible: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
    },
    adminLogin: string,
  ) {
    const row = await this.prisma.siteAnnouncement.create({
      data: {
        title: data.title,
        body: data.body,
        active: data.active,
        dismissible: data.dismissible,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        createdBy: adminLogin,
      },
    });
    return mapAnnouncement(row);
  }

  async update(id: string, data: Partial<Parameters<AnnouncementService['create']>[0]>) {
    const existing = await this.prisma.siteAnnouncement.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCode.ANNOUNCEMENT_NOT_FOUND, 404);

    const row = await this.prisma.siteAnnouncement.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.dismissible !== undefined ? { dismissible: data.dismissible } : {}),
        ...(data.startsAt !== undefined
          ? { startsAt: data.startsAt ? new Date(data.startsAt) : null }
          : {}),
        ...(data.endsAt !== undefined
          ? { endsAt: data.endsAt ? new Date(data.endsAt) : null }
          : {}),
      },
    });
    return mapAnnouncement(row);
  }

  async remove(id: string) {
    await this.prisma.siteAnnouncement.delete({ where: { id } });
    return { ok: true };
  }

  async getActiveForUser(userId: string) {
    const now = new Date();
    const rows = await this.prisma.siteAnnouncement.findMany({
      where: {
        active: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const row of rows) {
      if (!row.dismissible) return mapAnnouncement(row);
      const dismissed = await this.prisma.userAnnouncementDismissal.findUnique({
        where: { userId_announcementId: { userId, announcementId: row.id } },
      });
      if (!dismissed) return mapAnnouncement(row);
    }
    return null;
  }

  async dismiss(userId: string, announcementId: string) {
    const row = await this.prisma.siteAnnouncement.findUnique({ where: { id: announcementId } });
    if (!row) throw new AppError(ErrorCode.ANNOUNCEMENT_NOT_FOUND, 404);
    if (!row.dismissible) throw new AppError(ErrorCode.VALIDATION_ERROR, 400);

    await this.prisma.userAnnouncementDismissal.upsert({
      where: { userId_announcementId: { userId, announcementId } },
      create: { userId, announcementId },
      update: { dismissedAt: new Date() },
    });
    return { ok: true };
  }
}
