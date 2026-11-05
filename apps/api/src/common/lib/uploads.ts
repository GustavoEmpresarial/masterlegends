import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../../config/env.js';
import { AppError, ErrorCode } from './errors.js';

import { sanitizeImageBuffer } from './secure-image.js';
import { VESTIARIO_VIDEO_MAX_BYTES as SHARED_VESTIARIO_VIDEO_MAX_BYTES } from '@mll/shared';

export { SHARED_VESTIARIO_VIDEO_MAX_BYTES as VESTIARIO_VIDEO_MAX_BYTES };

const ALLOWED_MIME = new Map<string, string>([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
]);

const VESTIARIO_VIDEO_MIME = new Map<string, string>([
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
]);

const ITEMS_SUBDIR = 'items';
const STADIUMS_SUBDIR = 'stadiums';
const VESTIARIO_SUBDIR = 'vestiario';
const OFFICE_SUBDIR = 'office';
const YOUTUBE_CREATORS_SUBDIR = 'youtube-creators';
const BLOG_SUBDIR = 'blog';
const TRANSPARENCY_SUBDIR = 'transparency';
const NOTICES_SUBDIR = 'notices';

function itemsDir(): string {
  return path.resolve(config.UPLOADS_DIR, ITEMS_SUBDIR);
}

function stadiumsDir(): string {
  return path.resolve(config.UPLOADS_DIR, STADIUMS_SUBDIR);
}

async function saveImage(
  subdir: string,
  buffer: Buffer,
  mime: string,
): Promise<{ filename: string; url: string }> {
  const ext = ALLOWED_MIME.get(mime);
  if (!ext) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
      reason: 'unsupported_mime',
      allowed: Array.from(ALLOWED_MIME.keys()),
    });
  }
  if (buffer.byteLength > config.UPLOAD_MAX_BYTES) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
      reason: 'file_too_large',
      max: config.UPLOAD_MAX_BYTES,
      received: buffer.byteLength,
    });
  }

  const dir = path.resolve(config.UPLOADS_DIR, subdir);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}${ext}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, buffer);

  const url = `${config.UPLOADS_PUBLIC_PATH}/${subdir}/${filename}`;
  return { filename, url };
}

async function deleteImage(subdir: string, url: string | null | undefined): Promise<void> {
  if (!url) return;
  const prefix = `${config.UPLOADS_PUBLIC_PATH}/${subdir}/`;
  if (!url.startsWith(prefix)) return;
  const filename = url.slice(prefix.length);
  if (filename.includes('/') || filename.includes('..')) return;
  const fullPath = path.join(path.resolve(config.UPLOADS_DIR, subdir), filename);
  await fs.unlink(fullPath).catch(() => {});
}

export async function saveItemImage(
  buffer: Buffer,
  mime: string,
): Promise<{ filename: string; url: string }> {
  return saveImage(ITEMS_SUBDIR, buffer, mime);
}

export async function saveStadiumImage(
  buffer: Buffer,
  mime: string,
): Promise<{ filename: string; url: string }> {
  return saveImage(STADIUMS_SUBDIR, buffer, mime);
}

export async function saveVestiarioImage(
  buffer: Buffer,
  mime: string,
): Promise<{ filename: string; url: string }> {
  return saveImage(VESTIARIO_SUBDIR, buffer, mime);
}

async function saveVestiarioVideo(
  buffer: Buffer,
  mime: string,
): Promise<{ filename: string; url: string }> {
  const ext = VESTIARIO_VIDEO_MIME.get(mime);
  if (!ext) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
      reason: 'unsupported_mime',
      allowed: Array.from(VESTIARIO_VIDEO_MIME.keys()),
    });
  }
  if (buffer.byteLength > SHARED_VESTIARIO_VIDEO_MAX_BYTES) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
      reason: 'file_too_large',
      max: SHARED_VESTIARIO_VIDEO_MAX_BYTES,
      received: buffer.byteLength,
    });
  }

  const dir = path.resolve(config.UPLOADS_DIR, VESTIARIO_SUBDIR);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}${ext}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, buffer);

  const url = `${config.UPLOADS_PUBLIC_PATH}/${VESTIARIO_SUBDIR}/${filename}`;
  return { filename, url };
}

export async function saveVestiarioMedia(
  buffer: Buffer,
  mime: string,
): Promise<{ filename: string; url: string; backgroundType: 'image' | 'video' }> {
  if (VESTIARIO_VIDEO_MIME.has(mime)) {
    const saved = await saveVestiarioVideo(buffer, mime);
    return { ...saved, backgroundType: 'video' };
  }
  const saved = await saveVestiarioImage(buffer, mime);
  return { ...saved, backgroundType: 'image' };
}

export async function deleteVestiarioMedia(url: string | null | undefined): Promise<void> {
  return deleteImage(VESTIARIO_SUBDIR, url);
}

export async function deleteItemImage(url: string | null | undefined): Promise<void> {
  return deleteImage(ITEMS_SUBDIR, url);
}

export async function deleteStadiumImage(url: string | null | undefined): Promise<void> {
  return deleteImage(STADIUMS_SUBDIR, url);
}

export async function saveOfficeStaffImage(
  buffer: Buffer,
  mime: string,
): Promise<{ filename: string; url: string }> {
  return saveImage(OFFICE_SUBDIR, buffer, mime);
}

export async function deleteOfficeStaffImage(url: string | null | undefined): Promise<void> {
  return deleteImage(OFFICE_SUBDIR, url);
}

export async function saveYoutubeCreatorImage(
  buffer: Buffer,
): Promise<{ filename: string; url: string }> {
  const sanitized = await sanitizeImageBuffer(buffer, { maxPx: 1024 });
  const dir = path.resolve(config.UPLOADS_DIR, YOUTUBE_CREATORS_SUBDIR);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${sanitized.ext}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, sanitized.data);

  const url = `${config.UPLOADS_PUBLIC_PATH}/${YOUTUBE_CREATORS_SUBDIR}/${filename}`;
  return { filename, url };
}

export async function deleteYoutubeCreatorImage(url: string | null | undefined): Promise<void> {
  return deleteImage(YOUTUBE_CREATORS_SUBDIR, url);
}

export async function saveBlogCoverImage(
  buffer: Buffer,
  mime: string,
): Promise<{ filename: string; url: string }> {
  return saveImage(BLOG_SUBDIR, buffer, mime);
}

export async function deleteBlogCoverImage(url: string | null | undefined): Promise<void> {
  return deleteImage(BLOG_SUBDIR, url);
}

export async function saveTransparencyImage(
  buffer: Buffer,
  mime: string,
): Promise<{ filename: string; url: string }> {
  return saveImage(TRANSPARENCY_SUBDIR, buffer, mime);
}

export async function saveNoticeImage(
  buffer: Buffer,
  _mime?: string,
): Promise<{ filename: string; url: string }> {
  const sanitized = await sanitizeImageBuffer(buffer, {
    maxBytes: config.UPLOAD_MAX_BYTES,
  });

  const dir = path.resolve(config.UPLOADS_DIR, NOTICES_SUBDIR);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${sanitized.ext}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, sanitized.data);

  const url = `${config.UPLOADS_PUBLIC_PATH}/${NOTICES_SUBDIR}/${filename}`;
  return { filename, url };
}

export async function saveFinancialImage(
  buffer: Buffer,
  mime: string,
): Promise<{ filename: string; url: string }> {
  return saveImage(TRANSPARENCY_SUBDIR, buffer, mime);
}

export async function saveShopImage(
  buffer: Buffer,
  mime: string,
): Promise<{ filename: string; url: string }> {
  return saveImage('shop', buffer, mime);
}

export async function saveEventImage(
  buffer: Buffer,
  _mime?: string,
): Promise<{ filename: string; url: string }> {
  const sanitized = await sanitizeImageBuffer(buffer, {
    maxBytes: config.UPLOAD_MAX_BYTES,
  });

  const dir = path.resolve(config.UPLOADS_DIR, 'events');
  await fs.mkdir(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${sanitized.ext}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, sanitized.data);

  const url = `${config.UPLOADS_PUBLIC_PATH}/events/${filename}`;
  return { filename, url };
}

export async function saveGearImage(
  buffer: Buffer,
  _mime?: string,
): Promise<{ filename: string; url: string }> {
  const sanitized = await sanitizeImageBuffer(buffer, {
    maxBytes: config.UPLOAD_MAX_BYTES,
  });

  const dir = path.resolve(config.UPLOADS_DIR, 'gear');
  await fs.mkdir(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${sanitized.ext}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, sanitized.data);

  const url = `${config.UPLOADS_PUBLIC_PATH}/gear/${filename}`;
  return { filename, url };
}

export async function saveUserAvatarImage(
  buffer: Buffer,
): Promise<{ filename: string; url: string }> {
  const sanitized = await sanitizeImageBuffer(buffer, { maxPx: 512, maxBytes: config.UPLOAD_MAX_BYTES });
  const dir = path.resolve(config.UPLOADS_DIR, 'avatars');
  await fs.mkdir(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${sanitized.ext}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, sanitized.data);

  const url = `${config.UPLOADS_PUBLIC_PATH}/avatars/${filename}`;
  return { filename, url };
}

export async function deleteUserAvatarImage(url: string | null | undefined): Promise<void> {
  return deleteImage('avatars', url);
}

export async function saveBonecoImage(buffer: Buffer): Promise<{ filename: string; url: string }> {
  const sanitized = await sanitizeImageBuffer(buffer, { maxPx: 1024, maxBytes: config.UPLOAD_MAX_BYTES });
  const dir = path.resolve(config.UPLOADS_DIR, 'bonecos');
  await fs.mkdir(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${sanitized.ext}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, sanitized.data);

  const url = `${config.UPLOADS_PUBLIC_PATH}/bonecos/${filename}`;
  return { filename, url };
}

export async function deleteBonecoImage(url: string | null | undefined): Promise<void> {
  return deleteImage('bonecos', url);
}
