import type { PrismaClient, StadiumTemplate } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { StadiumSlot, StadiumTemplateDTO } from '@mll/shared';
import { stadiumSlotsSchema } from '@mll/shared';

export class StadiumRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list(filters: { active?: boolean; limit?: number } = {}) {
    return this.prisma.stadiumTemplate.findMany({
      where: {
        ...(filters.active !== undefined ? { active: filters.active } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: Math.min(100, Math.max(1, filters.limit ?? 50)),
    });
  }

  findById(id: string) {
    return this.prisma.stadiumTemplate.findUnique({ where: { id } });
  }

  create(data: Prisma.StadiumTemplateCreateInput) {
    return this.prisma.stadiumTemplate.create({ data });
  }

  update(id: string, data: Prisma.StadiumTemplateUpdateInput) {
    return this.prisma.stadiumTemplate.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.stadiumTemplate.delete({ where: { id } });
  }

  clearDefaultExcept(id: string) {
    return this.prisma.stadiumTemplate.updateMany({
      where: { id: { not: id }, isDefault: true },
      data: { isDefault: false },
    });
  }

  clearAllDefaults() {
    return this.prisma.stadiumTemplate.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  findDefaultTemplate() {
    return this.prisma.stadiumTemplate.findFirst({
      where: { isDefault: true, active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findLineupByClubId(clubId: string) {
    return this.prisma.clubLineup.findUnique({
      where: { clubId },
      include: { stadiumTemplate: true },
    });
  }

  upsertLineup(clubId: string, stadiumTemplateId: string, assignments: Prisma.InputJsonValue) {
    return this.prisma.clubLineup.upsert({
      where: { clubId },
      create: { clubId, stadiumTemplateId, assignments },
      update: { stadiumTemplateId, assignments },
    });
  }
}

export function toStadiumDTO(row: StadiumTemplate): StadiumTemplateDTO {
  const slots = stadiumSlotsSchema.parse(row.slots);
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.imageUrl,
    slots: slots as StadiumSlot[],
    priceUsdc: row.priceUsdc !== null ? Number(row.priceUsdc) : null,
    active: row.active,
    isDefault: row.isDefault,
    sortOrder: row.sortOrder,
    farmBonusPct: Number(row.farmBonusPct),
    requireRareStarters: row.requireRareStarters ?? 11,
    requireMinOverwall: row.requireMinOverwall ?? 0,
    requireOwnedTemplateId: row.requireOwnedTemplateId ?? null,
    requirementNote: row.requirementNote ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
