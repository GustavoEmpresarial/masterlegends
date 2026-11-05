import type { StadiumSlot, VestiarioBackgroundType, VestiarioTemplateDTO } from '@mll/shared';
import { VestiarioTemplateRepository } from './vestiario-template.repository.js';

export class VestiarioTemplateService {
  constructor(private readonly repo: VestiarioTemplateRepository) {}

  get(): Promise<VestiarioTemplateDTO> { return this.repo.getDefault(); }
  list(): Promise<VestiarioTemplateDTO[]> { return this.repo.list(); }
  getById(id: string): Promise<VestiarioTemplateDTO | null> { return this.repo.getById(id); }

  create(data: {
    name: string;
    imageUrl: string;
    backgroundType: VestiarioBackgroundType;
    slots: StadiumSlot[];
  }): Promise<VestiarioTemplateDTO> { return this.repo.create(data); }

  update(
    id: string,
    patch: { name?: string; imageUrl?: string; backgroundType?: VestiarioBackgroundType; slots?: StadiumSlot[]; active?: boolean },
  ): Promise<VestiarioTemplateDTO> { return this.repo.update(id, patch); }

  setDefault(id: string): Promise<VestiarioTemplateDTO> { return this.repo.setDefault(id); }

  async delete(id: string): Promise<void> {
    const item = await this.repo.getById(id);
    if (item?.isDefault) throw new Error('Não é possível excluir o vestiário padrão');
    await this.repo.delete(id);
  }
}
