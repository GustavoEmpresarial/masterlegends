import type { Prisma } from '@prisma/client';
import type { StadiumSlot, StadiumTemplateDTO } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { deleteStadiumImage } from '../../common/lib/uploads.js';
import { StadiumRepository, toStadiumDTO } from './stadium.repository.js';

export interface CreateStadiumInput {
  name: string;
  imageUrl: string;
  slots: StadiumSlot[];
  priceUsdc?: number | null;
  active?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  farmBonusPct?: number;
  requireRareStarters?: number;
  requireMinOverwall?: number;
  requireOwnedTemplateId?: string | null;
  requirementNote?: string | null;
}

export interface PatchStadiumInput {
  name?: string;
  imageUrl?: string;
  slots?: StadiumSlot[];
  priceUsdc?: number | null;
  active?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  farmBonusPct?: number;
  requireRareStarters?: number;
  requireMinOverwall?: number;
  requireOwnedTemplateId?: string | null;
  requirementNote?: string | null;
}

export class StadiumService {
  constructor(private readonly repo: StadiumRepository) {}

  async list(filters: { active?: boolean; limit?: number } = {}): Promise<StadiumTemplateDTO[]> {
    const rows = await this.repo.list(filters);
    return rows.map(toStadiumDTO);
  }

  async getById(id: string): Promise<StadiumTemplateDTO> {
    const row = await this.repo.findById(id);
    if (!row) throw new AppError(ErrorCode.STADIUM_TEMPLATE_NOT_FOUND, 404);
    return toStadiumDTO(row);
  }

  async create(input: CreateStadiumInput): Promise<StadiumTemplateDTO> {
    if (input.isDefault) {
      await this.repo.clearAllDefaults();
    }
    const row = await this.repo.create(this.toCreateData(input));
    return toStadiumDTO(row);
  }

  async update(id: string, patch: PatchStadiumInput): Promise<StadiumTemplateDTO> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new AppError(ErrorCode.STADIUM_TEMPLATE_NOT_FOUND, 404);

    if (patch.imageUrl && patch.imageUrl !== existing.imageUrl) {
      await deleteStadiumImage(existing.imageUrl);
    }

    if (patch.isDefault === true) {
      await this.repo.clearDefaultExcept(id);
    }

    const row = await this.repo.update(id, this.toUpdateData(patch));
    return toStadiumDTO(row);
  }

  async setActive(id: string, active: boolean): Promise<StadiumTemplateDTO> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new AppError(ErrorCode.STADIUM_TEMPLATE_NOT_FOUND, 404);
    const row = await this.repo.update(id, { active });
    return toStadiumDTO(row);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new AppError(ErrorCode.STADIUM_TEMPLATE_NOT_FOUND, 404);
    if (existing.isDefault) {
      throw new AppError(ErrorCode.STADIUM_DEFAULT_DELETE_FORBIDDEN, 400);
    }
    await this.repo.delete(id);
    await deleteStadiumImage(existing.imageUrl);
  }

  private toCreateData(input: CreateStadiumInput): Prisma.StadiumTemplateCreateInput {
    return {
      name: input.name,
      imageUrl: input.imageUrl,
      slots: input.slots as Prisma.InputJsonValue,
      priceUsdc: input.priceUsdc ?? null,
      active: input.active ?? false,
      isDefault: input.isDefault ?? false,
      sortOrder: input.sortOrder ?? 0,
      ...(input.farmBonusPct !== undefined ? { farmBonusPct: input.farmBonusPct } : {}),
      requireRareStarters: input.requireRareStarters ?? 11,
      requireMinOverwall: input.requireMinOverwall ?? 0,
      ...(input.requireOwnedTemplateId
        ? { requireOwnedTemplate: { connect: { id: input.requireOwnedTemplateId } } }
        : {}),
      requirementNote: input.requirementNote?.trim() || null,
    };
  }

  private toUpdateData(patch: PatchStadiumInput): Prisma.StadiumTemplateUpdateInput {
    const data: Prisma.StadiumTemplateUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.imageUrl !== undefined) data.imageUrl = patch.imageUrl;
    if (patch.slots !== undefined) data.slots = patch.slots as Prisma.InputJsonValue;
    if (patch.priceUsdc !== undefined) data.priceUsdc = patch.priceUsdc;
    if (patch.active !== undefined) data.active = patch.active;
    if (patch.isDefault !== undefined) data.isDefault = patch.isDefault;
    if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;
    if (patch.farmBonusPct !== undefined) data.farmBonusPct = patch.farmBonusPct;
    if (patch.requireRareStarters !== undefined) data.requireRareStarters = patch.requireRareStarters;
    if (patch.requireMinOverwall !== undefined) data.requireMinOverwall = patch.requireMinOverwall;
    if (patch.requireOwnedTemplateId !== undefined) {
      data.requireOwnedTemplate = patch.requireOwnedTemplateId
        ? { connect: { id: patch.requireOwnedTemplateId } }
        : { disconnect: true };
    }
    if (patch.requirementNote !== undefined) {
      data.requirementNote = patch.requirementNote?.trim() || null;
    }
    return data;
  }
}
