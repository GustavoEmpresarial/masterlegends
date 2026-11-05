import type { PrismaClient, VestiarioTemplate } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { StadiumSlot, VestiarioBackgroundType, VestiarioTemplateDTO } from '@mll/shared';
import { inferVestiarioBackgroundType, stadiumSlotsSchema, VESTIARIO_TEMPLATE_ID } from '@mll/shared';

const DEFAULT_SLOTS: StadiumSlot[] = [
  { id: 's001', label: 'GOL',   xPct: 50, yPct: 82, role: 'GK',  zIndex: 1 },
  { id: 's002', label: 'ZAG-1', xPct: 28, yPct: 68, role: 'DEF', zIndex: 2 },
  { id: 's003', label: 'ZAG-2', xPct: 42, yPct: 70, role: 'DEF', zIndex: 3 },
  { id: 's004', label: 'ZAG-3', xPct: 58, yPct: 70, role: 'DEF', zIndex: 4 },
  { id: 's005', label: 'ZAG-4', xPct: 72, yPct: 68, role: 'DEF', zIndex: 5 },
  { id: 's006', label: 'MEI-1', xPct: 35, yPct: 52, role: 'MID', zIndex: 6 },
  { id: 's007', label: 'MEI-2', xPct: 50, yPct: 50, role: 'MID', zIndex: 7 },
  { id: 's008', label: 'MEI-3', xPct: 65, yPct: 52, role: 'MID', zIndex: 8 },
  { id: 's009', label: 'ATA-1', xPct: 38, yPct: 32, role: 'FW',  zIndex: 9 },
  { id: 's010', label: 'ATA-2', xPct: 50, yPct: 28, role: 'FW',  zIndex: 10 },
  { id: 's011', label: 'ATA-3', xPct: 62, yPct: 32, role: 'FW',  zIndex: 11 },
];

export function toVestiarioTemplateDTO(row: VestiarioTemplate): VestiarioTemplateDTO {
  const slots = stadiumSlotsSchema.parse(row.slots);
  return {
    id: row.id,
    name: (row as any).name ?? 'Vestiário Padrão',
    imageUrl: row.imageUrl,
    backgroundType: inferVestiarioBackgroundType(row.imageUrl, row.backgroundType as VestiarioBackgroundType),
    slots: slots as StadiumSlot[],
    active: (row as any).active ?? true,
    isDefault: (row as any).isDefault ?? false,
    sortOrder: (row as any).sortOrder ?? 0,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class VestiarioTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ensureDefault(): Promise<VestiarioTemplate> {
    return this.prisma.vestiarioTemplate.upsert({
      where: { id: VESTIARIO_TEMPLATE_ID },
      create: {
        id: VESTIARIO_TEMPLATE_ID,
        imageUrl: '/uploads/stadiums/default.png',
        backgroundType: 'image',
        slots: DEFAULT_SLOTS as unknown as Prisma.InputJsonValue,
        ...(({ name: 'Vestiário Padrão', active: true, isDefault: true, sortOrder: 0 }) as any),
      },
      update: {},
    });
  }

  async getDefault(): Promise<VestiarioTemplateDTO> {
    // Try to get the active default; fall back to any active; fall back to singleton
    const row = await this.prisma.vestiarioTemplate.findFirst({
      where: { isDefault: true, active: true } as any,
      orderBy: { updatedAt: 'desc' },
    }) ?? await this.ensureDefault();
    return toVestiarioTemplateDTO(row);
  }

  async list(): Promise<VestiarioTemplateDTO[]> {
    const rows = await this.prisma.vestiarioTemplate.findMany({
      orderBy: [{ sortOrder: 'asc' } as any, { createdAt: 'asc' } as any],
    });
    if (rows.length === 0) {
      await this.ensureDefault();
      return this.list();
    }
    return rows.map(toVestiarioTemplateDTO);
  }

  async getById(id: string): Promise<VestiarioTemplateDTO | null> {
    const row = await this.prisma.vestiarioTemplate.findUnique({ where: { id } });
    return row ? toVestiarioTemplateDTO(row) : null;
  }

  async create(data: {
    name: string;
    imageUrl: string;
    backgroundType: VestiarioBackgroundType;
    slots: StadiumSlot[];
  }): Promise<VestiarioTemplateDTO> {
    const row = await this.prisma.vestiarioTemplate.create({
      data: {
        imageUrl: data.imageUrl,
        backgroundType: data.backgroundType,
        slots: data.slots as unknown as Prisma.InputJsonValue,
        ...({ name: data.name, active: true, isDefault: false, sortOrder: 0 } as any),
      },
    });
    return toVestiarioTemplateDTO(row);
  }

  async update(
    id: string,
    patch: {
      name?: string;
      imageUrl?: string;
      backgroundType?: VestiarioBackgroundType;
      slots?: StadiumSlot[];
      active?: boolean;
    },
  ): Promise<VestiarioTemplateDTO> {
    const row = await this.prisma.vestiarioTemplate.update({
      where: { id },
      data: {
        ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl } : {}),
        ...(patch.backgroundType !== undefined ? { backgroundType: patch.backgroundType } : {}),
        ...(patch.slots !== undefined ? { slots: patch.slots as unknown as Prisma.InputJsonValue } : {}),
        ...((patch.name !== undefined || patch.active !== undefined)
          ? ({ name: patch.name, active: patch.active } as any)
          : {}),
      },
    });
    return toVestiarioTemplateDTO(row);
  }

  async setDefault(id: string): Promise<VestiarioTemplateDTO> {
    await this.prisma.vestiarioTemplate.updateMany({
      data: { isDefault: false } as any,
    });
    const row = await this.prisma.vestiarioTemplate.update({
      where: { id },
      data: { isDefault: true, active: true } as any,
    });
    return toVestiarioTemplateDTO(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.vestiarioTemplate.delete({ where: { id } });
  }
}
