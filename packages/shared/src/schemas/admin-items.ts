import { z } from 'zod';

export const itemTemplateCreateSchema = z.object({
  name: z.string().min(1).max(64),
  rarity: z.number().int().min(0).max(5),
  position: z.number().int().min(0).max(4),
  overwall: z.number().int().min(0).max(1_000_000),
  weight: z.number().int().min(1).max(10_000).default(1),
  active: z.boolean().default(true),
});

export const itemTemplatePatchSchema = itemTemplateCreateSchema
  .partial()
  .extend({
    // imageUrl can be replaced via multipart; not via JSON patch
  });

export const itemTemplateActiveSchema = z.object({
  active: z.boolean(),
});

export interface ItemTemplateDTO {
  id: string;
  name: string;
  imageUrl: string;
  rarity: number;
  position: number;
  overwall: number;
  weight: number;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
