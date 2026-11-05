import type { PrismaClient } from '@prisma/client';
import { AppError, ErrorCode } from '../../common/lib/errors.js';

interface NoticeDTO {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  imageUrl: string | null;
  active: boolean;
  showAsPopup: boolean;
  popupRepeatDaily: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapNotice(row: {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  imageUrl: string | null;
  active: boolean;
  showAsPopup: boolean;
  popupRepeatDaily: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}): NoticeDTO {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    priority: row.priority,
    imageUrl: row.imageUrl,
    active: row.active,
    showAsPopup: row.showAsPopup,
    popupRepeatDaily: row.popupRepeatDaily,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class NoticesService {
  constructor(private readonly prisma: PrismaClient) {}

  async listAll() {
    const rows = await this.prisma.notice.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapNotice);
  }

  async listPublic(category?: string, popup?: boolean) {
    const now = new Date();
    const rows = await this.prisma.notice.findMany({
      where: {
        active: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        ...(category ? { category } : {}),
        ...(popup !== undefined ? { showAsPopup: popup } : {}),
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
    });
    return rows.map(mapNotice);
  }

  async create(data: {
    title: string;
    body: string;
    category: string;
    priority?: string;
    imageUrl?: string | null;
    active?: boolean;
    showAsPopup?: boolean;
    popupRepeatDaily?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
  }, adminLogin: string) {
    const row = await this.prisma.notice.create({
      data: {
        title: data.title,
        body: data.body,
        category: data.category,
        priority: data.priority ?? 'normal',
        imageUrl: data.imageUrl ?? null,
        active: data.active ?? true,
        showAsPopup: data.showAsPopup ?? false,
        popupRepeatDaily: data.popupRepeatDaily ?? false,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        createdBy: adminLogin,
      },
    });
    return mapNotice(row);
  }

  async update(id: string, data: Partial<{
    title: string;
    body: string;
    category: string;
    priority: string;
    imageUrl: string | null;
    active: boolean;
    showAsPopup: boolean;
    popupRepeatDaily: boolean;
    startsAt: string | null;
    endsAt: string | null;
  }>) {
    const existing = await this.prisma.notice.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCode.ANNOUNCEMENT_NOT_FOUND, 404);

    const row = await this.prisma.notice.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.showAsPopup !== undefined ? { showAsPopup: data.showAsPopup } : {}),
        ...(data.popupRepeatDaily !== undefined ? { popupRepeatDaily: data.popupRepeatDaily } : {}),
        ...(data.startsAt !== undefined
          ? { startsAt: data.startsAt ? new Date(data.startsAt) : null }
          : {}),
        ...(data.endsAt !== undefined
          ? { endsAt: data.endsAt ? new Date(data.endsAt) : null }
          : {}),
      },
    });
    return mapNotice(row);
  }

  async toggleActive(id: string) {
    const existing = await this.prisma.notice.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCode.ANNOUNCEMENT_NOT_FOUND, 404);

    const row = await this.prisma.notice.update({
      where: { id },
      data: { active: !existing.active },
    });
    return mapNotice(row);
  }

  async remove(id: string) {
    const existing = await this.prisma.notice.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCode.ANNOUNCEMENT_NOT_FOUND, 404);
    await this.prisma.notice.delete({ where: { id } });
    return { ok: true as const };
  }
}
