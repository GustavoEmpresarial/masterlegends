import { z } from 'zod';

export const YoutubeCreatorStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVOKED: 'revoked',
} as const;

export const YoutubeVideoStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVOKED: 'revoked',
} as const;

export const SOCIAL_WEEKLY_VIDEO_LIMIT = 2;

const youtubeChannelUrlSchema = z
  .string()
  .url()
  .max(255)
  .refine(
    (url) =>
      /^https?:\/\/(www\.)?youtube\.com\/(channel\/[\w-]+|c\/[\w.-]+|user\/[\w.-]+|@[\w.-]+)\/?$/i.test(
        url,
      ),
    { message: 'Invalid YouTube channel URL' },
  );

const youtubeVideoUrlSchema = z
  .string()
  .url()
  .max(255)
  .refine(
    (url) =>
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i.test(url),
    { message: 'Invalid YouTube video URL' },
  );

export const socialApplySchema = z.object({
  channelName: z.string().trim().min(2).max(64),
  channelUrl: youtubeChannelUrlSchema,
  description: z.string().trim().min(10).max(512),
});

export const socialProfilePatchSchema = z.object({
  channelName: z.string().trim().min(2).max(64),
  description: z.string().trim().min(10).max(512),
});

export const socialVideoSubmitSchema = z.object({
  videoUrl: youtubeVideoUrlSchema,
});

export const socialRejectSchema = z.object({
  reason: z.string().trim().min(3).max(512),
});

export interface YoutubeCreatorDTO {
  id: string;
  channelName: string;
  channelUrl: string;
  description: string;
  photoUrl: string;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SocialMeDTO {
  creator: YoutubeCreatorDTO | null;
  weeklyVideosUsed: number;
  weeklyVideosLimit: number;
  canSubmitVideo: boolean;
  myVideos: YoutubeVideoDTO[];
}

export interface YoutubeVideoDTO {
  id: string;
  videoUrl: string;
  videoId: string;
  status: string;
  weekStart: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  nftGrantedAt: string | null;
  createdAt: string;
  creator?: {
    id: string;
    channelName: string;
    channelUrl: string;
    photoUrl: string;
  };
}

export function extractYoutubeVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i,
  );
  return match?.[1] ?? null;
}
