import { z } from 'zod';
import { stadiumSlotsSchema, type StadiumSlot } from './stadium.js';

export const VESTIARIO_TEMPLATE_ID = 'default';

export const vestiarioBackgroundTypeSchema = z.enum(['image', 'video']);

export type VestiarioBackgroundType = z.infer<typeof vestiarioBackgroundTypeSchema>;

export const vestiarioTemplatePatchSchema = z.object({
  slots: stadiumSlotsSchema,
});

export interface VestiarioTemplateDTO {
  id: string;
  name: string;
  imageUrl: string;
  backgroundType: VestiarioBackgroundType;
  slots: StadiumSlot[];
  active: boolean;
  isDefault: boolean;
  sortOrder: number;
  updatedAt: string;
}

/** Detecta vídeo pela extensão quando backgroundType não está no banco. */
export function inferVestiarioBackgroundType(
  url: string,
  stored?: VestiarioBackgroundType | null,
): VestiarioBackgroundType {
  if (stored === 'video' || stored === 'image') return stored;
  return /\.(mp4|webm)(\?|$)/i.test(url) ? 'video' : 'image';
}

export function isVestiarioVideoBackground(
  url: string,
  backgroundType?: VestiarioBackgroundType | null,
): boolean {
  return inferVestiarioBackgroundType(url, backgroundType) === 'video';
}

export const VESTIARIO_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VESTIARIO_VIDEO_MAX_BYTES = 20 * 1024 * 1024;
