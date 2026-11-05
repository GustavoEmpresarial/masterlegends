import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { z } from 'zod';
import {
  AdminPermission,
  ErrorCode,
  eventBadgeUpsertSchema,
  eventCampaignUpsertSchema,
  questDefinitionUpsertSchema,
} from '@mll/shared';
import { AppError } from '../../common/lib/errors.js';
import { adminGuard, requireAdminPermission } from '../../common/guards/admin.guard.js';
import { saveEventImage } from '../../common/lib/uploads.js';

const idParams = z.object({ id: z.string().uuid() });

export async function registerEventsAdminRoutes(app: FastifyInstance) {
  const pre = [adminGuard, requireAdminPermission(AdminPermission.MANAGE_EVENTS)];

  app.post('/events/upload-image', { preHandler: pre }, async (request) => {
    const data = await (request as FastifyRequest & { file: () => Promise<MultipartFile> }).file();
    if (!data) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'empty_file' });
    }
    const buffer = await data.toBuffer();
    if (!buffer.byteLength) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'empty_file' });
    }
    const { url } = await saveEventImage(buffer, data.mimetype);
    return { url };
  });

  // ── Campaigns ────────────────────────────────────────────
  app.get('/events/campaigns', { preHandler: pre }, async () => {
    const items = await app.prisma.eventCampaign.findMany({
      orderBy: [{ sortOrder: 'asc' }, { startsAt: 'desc' }],
      include: { _count: { select: { quests: true } } },
    });
    return { items };
  });

  app.post('/events/campaigns', { preHandler: pre }, async (request) => {
    const body = eventCampaignUpsertSchema.parse(request.body);
    if (new Date(body.endsAt) <= new Date(body.startsAt)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'endsAt_before_startsAt' });
    }
    const item = await app.prisma.eventCampaign.create({
      data: {
        slug: body.slug,
        title: body.title,
        body: body.body,
        imageUrl: body.imageUrl ?? null,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        active: body.active ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return { item };
  });

  app.patch('/events/campaigns/:id', { preHandler: pre }, async (request) => {
    const { id } = idParams.parse(request.params);
    const body = eventCampaignUpsertSchema.partial().parse(request.body);
    const item = await app.prisma.eventCampaign.update({
      where: { id },
      data: {
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
        ...(body.startsAt !== undefined ? { startsAt: new Date(body.startsAt) } : {}),
        ...(body.endsAt !== undefined ? { endsAt: new Date(body.endsAt) } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });
    return { item };
  });

  app.delete('/events/campaigns/:id', { preHandler: pre }, async (request) => {
    const { id } = idParams.parse(request.params);
    await app.prisma.eventCampaign.delete({ where: { id } });
    return { ok: true };
  });

  // ── Quests ───────────────────────────────────────────────
  app.get('/events/quests', { preHandler: pre }, async (request) => {
    const q = z
      .object({ kind: z.string().optional(), campaignId: z.string().uuid().optional() })
      .parse(request.query ?? {});
    const items = await app.prisma.questDefinition.findMany({
      where: {
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.campaignId ? { campaignId: q.campaignId } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { claims: true } } },
    });
    return { items };
  });

  app.post('/events/quests', { preHandler: pre }, async (request) => {
    const body = questDefinitionUpsertSchema.parse(request.body);
    const item = await app.prisma.questDefinition.create({
      data: {
        kind: body.kind,
        campaignId: body.campaignId ?? null,
        title: body.title,
        description: body.description,
        trigger: body.trigger,
        target: body.target,
        rewards: body.rewards,
        active: body.active ?? true,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        maxClaimsPerUser: body.maxClaimsPerUser ?? 1,
        maxGlobalClaims: body.maxGlobalClaims ?? null,
        requireEmailVerified: body.requireEmailVerified ?? true,
        period: body.period ?? (body.kind === 'daily_task' ? 'daily' : body.kind === 'weekly_task' ? 'weekly' : 'none'),
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return { item };
  });

  app.patch('/events/quests/:id', { preHandler: pre }, async (request) => {
    const { id } = idParams.parse(request.params);
    const body = questDefinitionUpsertSchema.partial().parse(request.body);
    const item = await app.prisma.questDefinition.update({
      where: { id },
      data: {
        ...(body.kind !== undefined ? { kind: body.kind } : {}),
        ...(body.campaignId !== undefined ? { campaignId: body.campaignId } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.trigger !== undefined ? { trigger: body.trigger } : {}),
        ...(body.target !== undefined ? { target: body.target } : {}),
        ...(body.rewards !== undefined ? { rewards: body.rewards } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.startsAt !== undefined
          ? { startsAt: body.startsAt ? new Date(body.startsAt) : null }
          : {}),
        ...(body.endsAt !== undefined
          ? { endsAt: body.endsAt ? new Date(body.endsAt) : null }
          : {}),
        ...(body.maxClaimsPerUser !== undefined
          ? { maxClaimsPerUser: body.maxClaimsPerUser }
          : {}),
        ...(body.maxGlobalClaims !== undefined
          ? { maxGlobalClaims: body.maxGlobalClaims }
          : {}),
        ...(body.requireEmailVerified !== undefined
          ? { requireEmailVerified: body.requireEmailVerified }
          : {}),
        ...(body.period !== undefined ? { period: body.period } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });
    return { item };
  });

  app.delete('/events/quests/:id', { preHandler: pre }, async (request) => {
    const { id } = idParams.parse(request.params);
    await app.prisma.questDefinition.delete({ where: { id } });
    return { ok: true };
  });

  // ── Badges ───────────────────────────────────────────────
  app.get('/events/badges', { preHandler: pre }, async () => {
    const items = await app.prisma.eventBadge.findMany({ orderBy: { title: 'asc' } });
    return { items };
  });

  app.post('/events/badges', { preHandler: pre }, async (request) => {
    const body = eventBadgeUpsertSchema.parse(request.body);
    const item = await app.prisma.eventBadge.create({
      data: {
        code: body.code,
        title: body.title,
        iconUrl: body.iconUrl ?? null,
      },
    });
    return { item };
  });

  app.patch('/events/badges/:id', { preHandler: pre }, async (request) => {
    const { id } = idParams.parse(request.params);
    const body = eventBadgeUpsertSchema.partial().parse(request.body);
    const item = await app.prisma.eventBadge.update({
      where: { id },
      data: {
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.iconUrl !== undefined ? { iconUrl: body.iconUrl } : {}),
      },
    });
    return { item };
  });

  app.delete('/events/badges/:id', { preHandler: pre }, async (request) => {
    const { id } = idParams.parse(request.params);
    await app.prisma.eventBadge.delete({ where: { id } });
    return { ok: true };
  });

  // ── Claims audit ─────────────────────────────────────────
  app.get('/events/claims', { preHandler: pre }, async (request) => {
    const q = z
      .object({
        questId: z.string().uuid().optional(),
        userId: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      })
      .parse(request.query ?? {});
    const items = await app.prisma.questClaimLog.findMany({
      where: {
        ...(q.questId ? { questId: q.questId } : {}),
        ...(q.userId ? { userId: q.userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: q.limit ?? 50,
      include: {
        user: { select: { id: true, username: true, email: true } },
        quest: { select: { id: true, title: true, kind: true } },
      },
    });
    return { items };
  });
}
