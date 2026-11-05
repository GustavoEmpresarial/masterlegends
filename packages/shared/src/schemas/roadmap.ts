import { z } from 'zod';

export const ROADMAP_LOCALES = ['pt-BR', 'en', 'es'] as const;
export type RoadmapLocale = (typeof ROADMAP_LOCALES)[number];

const localePhaseSchema = z.object({
  phase: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  statusLabel: z.string().min(1).max(100),
});

const localeItemSchema = z.object({
  text: z.string().min(1).max(500),
});

export const roadmapPhaseI18nSchema = z.object({
  'pt-BR': localePhaseSchema,
  en: localePhaseSchema,
  es: localePhaseSchema,
});

export const roadmapItemI18nSchema = z.object({
  'pt-BR': localeItemSchema,
  en: localeItemSchema,
  es: localeItemSchema,
});

export const roadmapPhaseCreateSchema = z.object({
  status: z.enum(['done', 'active', 'upcoming']),
  color: z.string().min(1).max(32),
  visible: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  i18n: roadmapPhaseI18nSchema,
});

export const roadmapPhasePatchSchema = roadmapPhaseCreateSchema.partial();

export const roadmapItemCreateSchema = z.object({
  phaseId: z.string().uuid(),
  done: z.boolean().optional(),
  visible: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  i18n: roadmapItemI18nSchema,
});

export const roadmapItemPatchSchema = roadmapItemCreateSchema.omit({ phaseId: true }).partial();

export const roadmapReorderSchema = z.object({
  phases: z.array(z.object({ id: z.string().uuid(), order: z.number().int().min(0) })).optional(),
  items: z.array(z.object({ id: z.string().uuid(), order: z.number().int().min(0), phaseId: z.string().uuid().optional() })).optional(),
});

export interface RoadmapItemDTO {
  id: string;
  phaseId: string;
  order: number;
  done: boolean;
  visible: boolean;
  text: string;
}

export interface RoadmapPhaseDTO {
  id: string;
  order: number;
  status: string;
  color: string;
  visible: boolean;
  phase: string;
  title: string;
  statusLabel: string;
  items: RoadmapItemDTO[];
}

export interface RoadmapAdminPhaseDTO {
  id: string;
  order: number;
  status: string;
  color: string;
  visible: boolean;
  i18n: z.infer<typeof roadmapPhaseI18nSchema>;
  items: Array<{
    id: string;
    order: number;
    done: boolean;
    visible: boolean;
    i18n: z.infer<typeof roadmapItemI18nSchema>;
  }>;
  createdAt: string;
  updatedAt: string;
}
