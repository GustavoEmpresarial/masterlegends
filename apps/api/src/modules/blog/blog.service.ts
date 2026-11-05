import type { PrismaClient } from '@prisma/client';
import type { BlogPostDTO, BlogPostListDTO, BlogPostCreateInput, BlogPostUpdateInput, BlogPostQuery } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { deleteBlogCoverImage } from '../../common/lib/uploads.js';

function toDTO(row: {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  tags: string[];
  published: boolean;
  publishedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): BlogPostDTO {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    coverImageUrl: row.coverImage ?? null,
    tags: row.tags,
    published: row.published,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toListDTO(row: {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  tags: string[];
  published: boolean;
  publishedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}): BlogPostListDTO {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl: row.coverImage ?? null,
    tags: row.tags,
    published: row.published,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export class BlogService {
  constructor(private readonly prisma: PrismaClient) {}

  async listPublic(query: BlogPostQuery): Promise<{ items: BlogPostListDTO[]; nextCursor: string | null }> {
    const take = query.limit + 1;
    const rows = await this.prisma.blogPost.findMany({
      take,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      where: {
        published: true,
        ...(query.tag ? { tags: { has: query.tag } } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' } },
                { excerpt: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverImage: true,
        tags: true,
        published: true,
        publishedAt: true,
        createdBy: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    return { items: items.map(toListDTO), nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async getBySlugPublic(slug: string): Promise<BlogPostDTO> {
    const row = await this.prisma.blogPost.findFirst({ where: { slug, published: true } });
    if (!row) throw new AppError(ErrorCode.BLOG_POST_NOT_FOUND, 404);
    return toDTO(row);
  }

  // Admin ──────────────────────────────────────────────────────────────────

  async adminList(): Promise<BlogPostListDTO[]> {
    const rows = await this.prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverImage: true,
        tags: true,
        published: true,
        publishedAt: true,
        createdBy: true,
        createdAt: true,
      },
    });
    return rows.map(toListDTO);
  }

  async adminGet(id: string): Promise<BlogPostDTO> {
    const row = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!row) throw new AppError(ErrorCode.BLOG_POST_NOT_FOUND, 404);
    return toDTO(row);
  }

  async create(input: BlogPostCreateInput, createdBy: string): Promise<BlogPostDTO> {
    const existing = await this.prisma.blogPost.findUnique({ where: { slug: input.slug } });
    if (existing) throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'slug_taken' });

    const row = await this.prisma.blogPost.create({
      data: {
        ...input,
        publishedAt: input.published ? new Date() : null,
        createdBy,
      },
    });
    return toDTO(row);
  }

  async update(id: string, input: BlogPostUpdateInput): Promise<BlogPostDTO> {
    const current = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!current) throw new AppError(ErrorCode.BLOG_POST_NOT_FOUND, 404);

    if (input.slug && input.slug !== current.slug) {
      const conflict = await this.prisma.blogPost.findUnique({ where: { slug: input.slug } });
      if (conflict) throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'slug_taken' });
    }

    const nowPublishing = input.published === true && !current.published;

    const row = await this.prisma.blogPost.update({
      where: { id },
      data: {
        ...input,
        publishedAt: nowPublishing ? new Date() : current.publishedAt,
      },
    });
    return toDTO(row);
  }

  async updateCover(id: string, coverImageUrl: string): Promise<BlogPostDTO> {
    const current = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!current) throw new AppError(ErrorCode.BLOG_POST_NOT_FOUND, 404);

    if (current.coverImage) {
      await deleteBlogCoverImage(current.coverImage);
    }

    const row = await this.prisma.blogPost.update({
      where: { id },
      data: { coverImage: coverImageUrl },
    });
    return toDTO(row);
  }

  async removeCover(id: string): Promise<BlogPostDTO> {
    const current = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!current) throw new AppError(ErrorCode.BLOG_POST_NOT_FOUND, 404);
    await deleteBlogCoverImage(current.coverImage);
    const row = await this.prisma.blogPost.update({ where: { id }, data: { coverImage: null } });
    return toDTO(row);
  }

  async delete(id: string): Promise<void> {
    const current = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!current) throw new AppError(ErrorCode.BLOG_POST_NOT_FOUND, 404);
    await deleteBlogCoverImage(current.coverImage);
    await this.prisma.blogPost.delete({ where: { id } });
  }
}
