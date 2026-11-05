import type { PrismaClient } from '@prisma/client';
import {
  SOCIAL_WEEKLY_VIDEO_LIMIT,
  YoutubeCreatorStatus,
  YoutubeVideoStatus,
  extractYoutubeVideoId,
  type SocialMeDTO,
  type YoutubeCreatorDTO,
  type YoutubeVideoDTO,
} from '@mll/shared';
import { POSITION_NAMES } from '../../config/game.js';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { secureRandom } from '../../common/lib/secure-random.js';
import {
  deleteYoutubeCreatorImage,
  saveYoutubeCreatorImage,
} from '../../common/lib/uploads.js';

function weekStartUtc(date = new Date()): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function toCreatorDto(row: {
  id: string;
  channelName: string;
  channelUrl: string;
  description: string;
  photoUrl: string;
  status: string;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): YoutubeCreatorDTO {
  return {
    id: row.id,
    channelName: row.channelName,
    channelUrl: row.channelUrl,
    description: row.description,
    photoUrl: row.photoUrl,
    status: row.status,
    rejectionReason: row.rejectionReason,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toVideoDto(
  row: {
    id: string;
    videoUrl: string;
    videoId: string;
    status: string;
    weekStart: Date;
    rejectionReason: string | null;
    reviewedAt: Date | null;
    nftGrantedAt: Date | null;
    createdAt: Date;
  },
  creator?: { id: string; channelName: string; channelUrl: string; photoUrl: string },
): YoutubeVideoDTO {
  return {
    id: row.id,
    videoUrl: row.videoUrl,
    videoId: row.videoId,
    status: row.status,
    weekStart: row.weekStart.toISOString().slice(0, 10),
    rejectionReason: row.rejectionReason,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    nftGrantedAt: row.nftGrantedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    ...(creator
      ? {
          creator: {
            id: creator.id,
            channelName: creator.channelName,
            channelUrl: creator.channelUrl,
            photoUrl: creator.photoUrl,
          },
        }
      : {}),
  };
}

export class SocialService {
  constructor(private readonly prisma: PrismaClient) {}

  private async grantSocialRewardNft(userId: string) {
    const cfg = await this.prisma.platformConfig.findUnique({ where: { id: 'default' } });
    const name = cfg?.socialRewardNftName ?? 'Craque Criador';
    const imageUrl = cfg?.socialRewardNftImageUrl ?? null;
    const overwall = cfg?.socialRewardNftOverwall ?? 100;
    const position = cfg?.socialRewardNftPosition ?? 2;
    const days = cfg?.socialRewardNftDays ?? 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.basePlayer.create({
        data: {
          userId,
          rarity: 0,
          overwall,
          position,
          name,
          imageUrl,
          source: 'social_reward',
          expiresAt,
        },
      });
      const agg = await tx.basePlayer.aggregate({
        where: { userId, retiredAt: null },
        _sum: { overwall: true },
      });
      await tx.club.update({
        where: { userId },
        data: { totalOverwall: agg._sum.overwall ?? 0 },
      });
    });
  }

  private async countWeeklySubmissions(creatorId: string, weekStart: Date) {
    return this.prisma.youtubeVideo.count({
      where: {
        creatorId,
        weekStart,
        status: { in: [YoutubeVideoStatus.PENDING, YoutubeVideoStatus.APPROVED] },
      },
    });
  }

  async getPublicFeed(limit = 50): Promise<{ videos: YoutubeVideoDTO[] }> {
    const rows = await this.prisma.youtubeVideo.findMany({
      where: { status: YoutubeVideoStatus.APPROVED },
      include: {
        creator: {
          select: {
            id: true,
            channelName: true,
            channelUrl: true,
            photoUrl: true,
            status: true,
          },
        },
      },
      orderBy: { reviewedAt: 'desc' },
      take: Math.min(limit, 100),
    });

    return {
      videos: rows
        .filter((row) => row.creator.status === YoutubeCreatorStatus.APPROVED)
        .map((row) =>
          toVideoDto(row, {
            id: row.creator.id,
            channelName: row.creator.channelName,
            channelUrl: row.creator.channelUrl,
            photoUrl: row.creator.photoUrl,
          }),
        ),
    };
  }

  async getMe(userId: string): Promise<SocialMeDTO> {
    const creator = await this.prisma.youtubeCreator.findUnique({ where: { userId } });
    const weekStart = weekStartUtc();
    const myVideos = creator
      ? await this.prisma.youtubeVideo.findMany({
          where: { creatorId: creator.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : [];

    const weeklyVideosUsed = creator
      ? await this.countWeeklySubmissions(creator.id, weekStart)
      : 0;

    const canSubmitVideo =
      creator?.status === YoutubeCreatorStatus.APPROVED &&
      weeklyVideosUsed < SOCIAL_WEEKLY_VIDEO_LIMIT;

    return {
      creator: creator ? toCreatorDto(creator) : null,
      weeklyVideosUsed,
      weeklyVideosLimit: SOCIAL_WEEKLY_VIDEO_LIMIT,
      canSubmitVideo,
      myVideos: myVideos.map((v) => toVideoDto(v)),
    };
  }

  async apply(
    userId: string,
    input: { channelName: string; channelUrl: string; description: string },
    photoBuffer: Buffer | null,
  ) {
    if (!photoBuffer?.byteLength) {
      throw new AppError(ErrorCode.SOCIAL_PHOTO_REQUIRED, 400);
    }

    const existing = await this.prisma.youtubeCreator.findUnique({ where: { userId } });
    if (existing && existing.status !== YoutubeCreatorStatus.REJECTED) {
      throw new AppError(ErrorCode.SOCIAL_CREATOR_EXISTS, 400);
    }

    const saved = await saveYoutubeCreatorImage(photoBuffer);

    if (existing?.status === YoutubeCreatorStatus.REJECTED) {
      await deleteYoutubeCreatorImage(existing.photoUrl);
      const updated = await this.prisma.youtubeCreator.update({
        where: { id: existing.id },
        data: {
          channelName: input.channelName,
          channelUrl: input.channelUrl,
          description: input.description,
          photoUrl: saved.url,
          status: YoutubeCreatorStatus.PENDING,
          rejectionReason: null,
          reviewedBy: null,
          reviewedAt: null,
        },
      });
      return { creator: toCreatorDto(updated) };
    }

    const created = await this.prisma.youtubeCreator.create({
      data: {
        userId,
        channelName: input.channelName,
        channelUrl: input.channelUrl,
        description: input.description,
        photoUrl: saved.url,
      },
    });
    return { creator: toCreatorDto(created) };
  }

  async updateProfile(
    userId: string,
    input: { channelName: string; description: string },
    photoBuffer: Buffer | null,
  ) {
    const creator = await this.prisma.youtubeCreator.findUnique({ where: { userId } });
    if (!creator) {
      throw new AppError(ErrorCode.SOCIAL_CREATOR_NOT_FOUND, 404);
    }
    if (creator.status !== YoutubeCreatorStatus.APPROVED) {
      throw new AppError(ErrorCode.SOCIAL_CREATOR_NOT_APPROVED, 400);
    }

    let photoUrl = creator.photoUrl;
    if (photoBuffer?.byteLength) {
      const saved = await saveYoutubeCreatorImage(photoBuffer);
      await deleteYoutubeCreatorImage(creator.photoUrl);
      photoUrl = saved.url;
    }

    const updated = await this.prisma.youtubeCreator.update({
      where: { id: creator.id },
      data: {
        channelName: input.channelName,
        description: input.description,
        photoUrl,
      },
    });
    return { creator: toCreatorDto(updated) };
  }

  async submitVideo(userId: string, videoUrl: string) {
    const creator = await this.prisma.youtubeCreator.findUnique({ where: { userId } });
    if (!creator) {
      throw new AppError(ErrorCode.SOCIAL_CREATOR_NOT_FOUND, 404);
    }
    if (creator.status === YoutubeCreatorStatus.PENDING) {
      throw new AppError(ErrorCode.SOCIAL_CREATOR_PENDING, 400);
    }
    if (creator.status !== YoutubeCreatorStatus.APPROVED) {
      throw new AppError(ErrorCode.SOCIAL_CREATOR_NOT_APPROVED, 400);
    }

    const videoId = extractYoutubeVideoId(videoUrl);
    if (!videoId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'invalid_video_url' });
    }

    const weekStart = weekStartUtc();
    const used = await this.countWeeklySubmissions(creator.id, weekStart);
    if (used >= SOCIAL_WEEKLY_VIDEO_LIMIT) {
      throw new AppError(ErrorCode.SOCIAL_WEEKLY_LIMIT, 400, {
        limit: SOCIAL_WEEKLY_VIDEO_LIMIT,
        used,
      });
    }

    try {
      const created = await this.prisma.youtubeVideo.create({
        data: {
          creatorId: creator.id,
          videoUrl,
          videoId,
          weekStart,
        },
      });
      return { video: toVideoDto(created) };
    } catch {
      throw new AppError(ErrorCode.SOCIAL_VIDEO_EXISTS, 400);
    }
  }

  async listPendingCreators() {
    const rows = await this.prisma.youtubeCreator.findMany({
      where: { status: YoutubeCreatorStatus.PENDING },
      include: { user: { select: { username: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      creators: rows.map((row) => ({
        ...toCreatorDto(row),
        username: row.user.username,
        email: row.user.email,
      })),
    };
  }

  async listPendingVideos() {
    const rows = await this.prisma.youtubeVideo.findMany({
      where: { status: YoutubeVideoStatus.PENDING },
      include: {
        creator: {
          include: { user: { select: { username: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return {
      videos: rows.map((row) => ({
        ...toVideoDto(row, {
          id: row.creator.id,
          channelName: row.creator.channelName,
          channelUrl: row.creator.channelUrl,
          photoUrl: row.creator.photoUrl,
        }),
        username: row.creator.user.username,
      })),
    };
  }

  async listApprovedCreators() {
    const rows = await this.prisma.youtubeCreator.findMany({
      where: { status: YoutubeCreatorStatus.APPROVED },
      include: {
        user: { select: { username: true, email: true } },
        _count: {
          select: {
            videos: {
              where: {
                status: { in: [YoutubeVideoStatus.APPROVED, YoutubeVideoStatus.PENDING] },
              },
            },
          },
        },
      },
      orderBy: { reviewedAt: 'desc' },
    });
    return {
      creators: rows.map((row) => ({
        ...toCreatorDto(row),
        username: row.user.username,
        email: row.user.email,
        videoCount: row._count.videos,
      })),
    };
  }

  async listApprovedVideos() {
    const rows = await this.prisma.youtubeVideo.findMany({
      where: { status: YoutubeVideoStatus.APPROVED },
      include: {
        creator: {
          include: { user: { select: { username: true } } },
        },
      },
      orderBy: { reviewedAt: 'desc' },
    });
    return {
      videos: rows.map((row) => ({
        ...toVideoDto(row, {
          id: row.creator.id,
          channelName: row.creator.channelName,
          channelUrl: row.creator.channelUrl,
          photoUrl: row.creator.photoUrl,
        }),
        username: row.creator.user.username,
      })),
    };
  }

  async approveCreator(creatorId: string, adminLogin: string) {
    const creator = await this.prisma.youtubeCreator.findUnique({ where: { id: creatorId } });
    if (!creator || creator.status !== YoutubeCreatorStatus.PENDING) {
      throw new AppError(ErrorCode.SOCIAL_CREATOR_NOT_FOUND, 404);
    }
    const updated = await this.prisma.youtubeCreator.update({
      where: { id: creatorId },
      data: {
        status: YoutubeCreatorStatus.APPROVED,
        rejectionReason: null,
        reviewedBy: adminLogin,
        reviewedAt: new Date(),
      },
    });
    return { creator: toCreatorDto(updated) };
  }

  async rejectCreator(creatorId: string, adminLogin: string, reason: string) {
    const creator = await this.prisma.youtubeCreator.findUnique({ where: { id: creatorId } });
    if (!creator || creator.status !== YoutubeCreatorStatus.PENDING) {
      throw new AppError(ErrorCode.SOCIAL_CREATOR_NOT_FOUND, 404);
    }
    const updated = await this.prisma.youtubeCreator.update({
      where: { id: creatorId },
      data: {
        status: YoutubeCreatorStatus.REJECTED,
        rejectionReason: reason,
        reviewedBy: adminLogin,
        reviewedAt: new Date(),
      },
    });
    return { creator: toCreatorDto(updated) };
  }

  async approveVideo(videoId: string, adminLogin: string) {
    const video = await this.prisma.youtubeVideo.findUnique({
      where: { id: videoId },
      include: { creator: true },
    });
    if (!video || video.status !== YoutubeVideoStatus.PENDING) {
      throw new AppError(ErrorCode.SOCIAL_VIDEO_NOT_FOUND, 404);
    }
    if (video.creator.status !== YoutubeCreatorStatus.APPROVED) {
      throw new AppError(ErrorCode.SOCIAL_CREATOR_NOT_APPROVED, 400);
    }

    const approvedThisWeek = await this.prisma.youtubeVideo.count({
      where: {
        creatorId: video.creatorId,
        weekStart: video.weekStart,
        status: YoutubeVideoStatus.APPROVED,
        id: { not: video.id },
      },
    });
    if (approvedThisWeek >= SOCIAL_WEEKLY_VIDEO_LIMIT) {
      throw new AppError(ErrorCode.SOCIAL_WEEKLY_LIMIT, 400);
    }

    await this.grantSocialRewardNft(video.creator.userId);

    const updated = await this.prisma.youtubeVideo.update({
      where: { id: videoId },
      data: {
        status: YoutubeVideoStatus.APPROVED,
        rejectionReason: null,
        reviewedBy: adminLogin,
        reviewedAt: new Date(),
        nftGrantedAt: new Date(),
      },
    });
    return { video: toVideoDto(updated) };
  }

  async rejectVideo(videoId: string, adminLogin: string, reason: string) {
    const video = await this.prisma.youtubeVideo.findUnique({ where: { id: videoId } });
    if (!video || video.status !== YoutubeVideoStatus.PENDING) {
      throw new AppError(ErrorCode.SOCIAL_VIDEO_NOT_FOUND, 404);
    }
    const updated = await this.prisma.youtubeVideo.update({
      where: { id: videoId },
      data: {
        status: YoutubeVideoStatus.REJECTED,
        rejectionReason: reason,
        reviewedBy: adminLogin,
        reviewedAt: new Date(),
      },
    });
    return { video: toVideoDto(updated) };
  }

  async revokeCreator(creatorId: string, adminLogin: string, reason: string) {
    const creator = await this.prisma.youtubeCreator.findUnique({ where: { id: creatorId } });
    if (!creator || creator.status !== YoutubeCreatorStatus.APPROVED) {
      throw new AppError(ErrorCode.SOCIAL_CREATOR_NOT_FOUND, 404);
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.youtubeCreator.update({
        where: { id: creatorId },
        data: {
          status: YoutubeCreatorStatus.REVOKED,
          rejectionReason: reason,
          reviewedBy: adminLogin,
          reviewedAt: now,
        },
      }),
      this.prisma.youtubeVideo.updateMany({
        where: {
          creatorId,
          status: { in: [YoutubeVideoStatus.PENDING, YoutubeVideoStatus.APPROVED] },
        },
        data: {
          status: YoutubeVideoStatus.REVOKED,
          rejectionReason: reason,
          reviewedBy: adminLogin,
          reviewedAt: now,
        },
      }),
    ]);

    const updated = await this.prisma.youtubeCreator.findUniqueOrThrow({ where: { id: creatorId } });
    return { creator: toCreatorDto(updated) };
  }

  async revokeVideo(videoId: string, adminLogin: string, reason: string) {
    const video = await this.prisma.youtubeVideo.findUnique({ where: { id: videoId } });
    if (!video || video.status !== YoutubeVideoStatus.APPROVED) {
      throw new AppError(ErrorCode.SOCIAL_VIDEO_NOT_FOUND, 404);
    }
    const updated = await this.prisma.youtubeVideo.update({
      where: { id: videoId },
      data: {
        status: YoutubeVideoStatus.REVOKED,
        rejectionReason: reason,
        reviewedBy: adminLogin,
        reviewedAt: new Date(),
      },
    });
    return { video: toVideoDto(updated) };
  }
}
