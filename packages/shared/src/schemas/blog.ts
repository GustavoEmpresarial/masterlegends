import { z } from 'zod';

export const blogPostCreateSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z
    .string()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug deve ser kebab-case'),
  excerpt: z.string().min(10).max(500),
  content: z.string().min(1).max(50000),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
  published: z.boolean().default(false),
});

export const blogPostUpdateSchema = blogPostCreateSchema.partial();

export const blogPostQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
  cursor: z.string().optional(),
  tag: z.string().optional(),
  q: z.string().optional(),
});

export type BlogPostCreateInput = z.infer<typeof blogPostCreateSchema>;
export type BlogPostUpdateInput = z.infer<typeof blogPostUpdateSchema>;
export type BlogPostQuery = z.infer<typeof blogPostQuerySchema>;

export interface BlogPostDTO {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  tags: string[];
  published: boolean;
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPostListDTO {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  tags: string[];
  published: boolean;
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
}
