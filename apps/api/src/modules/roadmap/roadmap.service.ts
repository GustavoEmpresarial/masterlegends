import type { PrismaClient } from '@prisma/client';
import type {
  RoadmapAdminPhaseDTO,
  RoadmapLocale,
  RoadmapPhaseDTO,
} from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { seedRoadmapIfEmpty } from './roadmap.seed.js';

function resolveLocale(raw: string | undefined): RoadmapLocale {
  if (raw === 'pt-BR' || raw === 'en' || raw === 'es') return raw;
  if (raw?.startsWith('pt')) return 'pt-BR';
  if (raw?.startsWith('es')) return 'es';
  return 'en';
}

function pickPhaseI18n(
  i18n: unknown,
  locale: RoadmapLocale,
): { phase: string; title: string; statusLabel: string } {
  const map = i18n as Record<string, { phase: string; title: string; statusLabel: string }>;
  return map[locale] ?? map['pt-BR'] ?? map.en ?? { phase: '', title: '', statusLabel: '' };
}

function pickItemText(i18n: unknown, locale: RoadmapLocale): string {
  const map = i18n as Record<string, { text: string }>;
  return map[locale]?.text ?? map['pt-BR']?.text ?? map.en?.text ?? '';
}

function mapAdminPhase(row: {
  id: string;
  order: number;
  status: string;
  color: string;
  visible: boolean;
  i18n: unknown;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    order: number;
    done: boolean;
    visible: boolean;
    i18n: unknown;
  }>;
}): RoadmapAdminPhaseDTO {
  return {
    id: row.id,
    order: row.order,
    status: row.status,
    color: row.color,
    visible: row.visible,
    i18n: row.i18n as RoadmapAdminPhaseDTO['i18n'],
    items: row.items
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        id: item.id,
        order: item.order,
        done: item.done,
        visible: item.visible,
        i18n: item.i18n as RoadmapAdminPhaseDTO['items'][0]['i18n'],
      })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class RoadmapService {
  constructor(private readonly prisma: PrismaClient) {}

  private phaseInclude = {
    items: { orderBy: { order: 'asc' as const } },
  } as const;

  async listPublic(localeRaw?: string): Promise<{ phases: RoadmapPhaseDTO[] }> {
    await seedRoadmapIfEmpty(this.prisma);
    const locale = resolveLocale(localeRaw);

    const rows = await this.prisma.roadmapPhase.findMany({
      where: { visible: true },
      orderBy: { order: 'asc' },
      include: {
        items: {
          where: { visible: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    const phases: RoadmapPhaseDTO[] = rows.map((row) => {
      const labels = pickPhaseI18n(row.i18n, locale);
      return {
        id: row.id,
        order: row.order,
        status: row.status,
        color: row.color,
        visible: row.visible,
        phase: labels.phase,
        title: labels.title,
        statusLabel: labels.statusLabel,
        items: row.items.map((item) => ({
          id: item.id,
          phaseId: item.phaseId,
          order: item.order,
          done: item.done,
          visible: item.visible,
          text: pickItemText(item.i18n, locale),
        })),
      };
    });

    return { phases };
  }

  async listAdmin(): Promise<{ phases: RoadmapAdminPhaseDTO[] }> {
    await seedRoadmapIfEmpty(this.prisma);
    const rows = await this.prisma.roadmapPhase.findMany({
      orderBy: { order: 'asc' },
      include: this.phaseInclude,
    });
    return { phases: rows.map(mapAdminPhase) };
  }

  async createPhase(data: {
    status: string;
    color: string;
    visible?: boolean;
    order?: number;
    i18n: unknown;
  }) {
    const maxOrder = await this.prisma.roadmapPhase.aggregate({ _max: { order: true } });
    const row = await this.prisma.roadmapPhase.create({
      data: {
        status: data.status,
        color: data.color,
        visible: data.visible ?? true,
        order: data.order ?? (maxOrder._max.order ?? -1) + 1,
        i18n: data.i18n as object,
      },
      include: this.phaseInclude,
    });
    return mapAdminPhase(row);
  }

  async updatePhase(
    id: string,
    data: Partial<{ status: string; color: string; visible: boolean; order: number; i18n: unknown }>,
  ) {
    const existing = await this.prisma.roadmapPhase.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCode.ANNOUNCEMENT_NOT_FOUND, 404);

    const row = await this.prisma.roadmapPhase.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.visible !== undefined ? { visible: data.visible } : {}),
        ...(data.order !== undefined ? { order: data.order } : {}),
        ...(data.i18n !== undefined ? { i18n: data.i18n as object } : {}),
      },
      include: this.phaseInclude,
    });
    return mapAdminPhase(row);
  }

  async deletePhase(id: string) {
    await this.prisma.roadmapPhase.delete({ where: { id } });
    return { ok: true };
  }

  async createItem(data: {
    phaseId: string;
    done?: boolean;
    visible?: boolean;
    order?: number;
    i18n: unknown;
  }) {
    const phase = await this.prisma.roadmapPhase.findUnique({ where: { id: data.phaseId } });
    if (!phase) throw new AppError(ErrorCode.ANNOUNCEMENT_NOT_FOUND, 404);

    const maxOrder = await this.prisma.roadmapItem.aggregate({
      where: { phaseId: data.phaseId },
      _max: { order: true },
    });

    await this.prisma.roadmapItem.create({
      data: {
        phaseId: data.phaseId,
        done: data.done ?? false,
        visible: data.visible ?? true,
        order: data.order ?? (maxOrder._max.order ?? -1) + 1,
        i18n: data.i18n as object,
      },
    });

    return this.getPhaseAdmin(data.phaseId);
  }

  async updateItem(
    id: string,
    data: Partial<{ done: boolean; visible: boolean; order: number; i18n: unknown; phaseId: string }>,
  ) {
    const existing = await this.prisma.roadmapItem.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCode.ANNOUNCEMENT_NOT_FOUND, 404);

    await this.prisma.roadmapItem.update({
      where: { id },
      data: {
        ...(data.done !== undefined ? { done: data.done } : {}),
        ...(data.visible !== undefined ? { visible: data.visible } : {}),
        ...(data.order !== undefined ? { order: data.order } : {}),
        ...(data.i18n !== undefined ? { i18n: data.i18n as object } : {}),
        ...(data.phaseId !== undefined ? { phaseId: data.phaseId } : {}),
      },
    });

    return this.getPhaseAdmin(existing.phaseId);
  }

  async deleteItem(id: string) {
    await this.prisma.roadmapItem.delete({ where: { id } });
    return { ok: true };
  }

  async reorder(data: {
    phases?: Array<{ id: string; order: number }>;
    items?: Array<{ id: string; order: number; phaseId?: string }>;
  }) {
    await this.prisma.$transaction(async (tx) => {
      for (const p of data.phases ?? []) {
        await tx.roadmapPhase.update({ where: { id: p.id }, data: { order: p.order } });
      }
      for (const item of data.items ?? []) {
        await tx.roadmapItem.update({
          where: { id: item.id },
          data: {
            order: item.order,
            ...(item.phaseId ? { phaseId: item.phaseId } : {}),
          },
        });
      }
    });
    return this.listAdmin();
  }

  private async getPhaseAdmin(phaseId: string) {
    const row = await this.prisma.roadmapPhase.findUnique({
      where: { id: phaseId },
      include: this.phaseInclude,
    });
    if (!row) throw new AppError(ErrorCode.ANNOUNCEMENT_NOT_FOUND, 404);
    return mapAdminPhase(row);
  }
}
