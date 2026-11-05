import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { config } from '../../config/env.js';
import { AppError, ErrorCode } from './errors.js';

const SUPPORT_SUBDIR = 'support';

const MIME_TO_EXT = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);

const MIME_TO_SHARP: Record<string, keyof sharp.FormatEnum> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
};

export interface SanitizedImageResult {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

function supportDir(): string {
  return path.resolve(config.PRIVATE_UPLOADS_DIR, SUPPORT_SUBDIR);
}

function assertRawSize(buffer: Buffer, maxBytes: number): void {
  if (!buffer.byteLength) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'empty_file' });
  }
  if (buffer.byteLength > maxBytes) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
      reason: 'file_too_large',
      max: maxBytes,
      received: buffer.byteLength,
    });
  }
}

export async function sanitizeImageBuffer(
  buffer: Buffer,
  opts?: { maxBytes?: number; maxPx?: number },
): Promise<{ data: Buffer; mimeType: string; ext: string; width: number; height: number; sizeBytes: number }> {
  const maxBytes = opts?.maxBytes ?? config.SUPPORT_UPLOAD_MAX_BYTES;
  const maxPx = opts?.maxPx ?? config.SUPPORT_IMAGE_MAX_PX;
  const maxPixels = maxPx * maxPx;

  assertRawSize(buffer, maxBytes);

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !MIME_TO_EXT.has(detected.mime)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
      reason: 'unsupported_mime',
      allowed: Array.from(MIME_TO_EXT.keys()),
    });
  }

  const mimeType = detected.mime;
  const ext = MIME_TO_EXT.get(mimeType)!;
  const format = MIME_TO_SHARP[mimeType];

  let width = 0;
  let height = 0;
  let output: Buffer;

  try {
    let pipeline = sharp(buffer, { failOn: 'error', animated: false }).rotate();

    const metadata = await pipeline.metadata();
    width = metadata.width ?? 0;
    height = metadata.height ?? 0;

    if (!width || !height) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'invalid_image_dimensions' });
    }

    if (width > maxPx || height > maxPx) {
      pipeline = pipeline.resize(maxPx, maxPx, { fit: 'inside', withoutEnlargement: true });
    }

    if (format === 'jpeg') {
      output = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    } else if (format === 'png') {
      output = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    } else {
      output = await pipeline.webp({ quality: 85 }).toBuffer();
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'invalid_image_dimensions' });
  }

  if (output.byteLength > maxBytes) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
      reason: 'file_too_large_after_encode',
      max: maxBytes,
      received: output.byteLength,
    });
  }

  const outMeta = await sharp(output).metadata();
  const outWidth = outMeta.width ?? width;
  const outHeight = outMeta.height ?? height;

  return {
    data: output,
    mimeType,
    ext,
    width: outWidth,
    height: outHeight,
    sizeBytes: output.byteLength,
  };
}

export async function saveSupportImage(buffer: Buffer): Promise<SanitizedImageResult> {
  const sanitized = await sanitizeImageBuffer(buffer);
  const dir = supportDir();
  await fs.mkdir(dir, { recursive: true });

  const storageKey = `${crypto.randomUUID()}.${sanitized.ext}`;
  const fullPath = path.join(dir, storageKey);
  await fs.writeFile(fullPath, sanitized.data);

  return {
    storageKey,
    mimeType: sanitized.mimeType,
    sizeBytes: sanitized.sizeBytes,
    width: sanitized.width,
    height: sanitized.height,
  };
}

export async function deleteSupportImage(storageKey: string | null | undefined): Promise<void> {
  if (!storageKey) return;
  if (storageKey.includes('/') || storageKey.includes('..') || storageKey.includes('\\')) return;

  const fullPath = path.join(supportDir(), storageKey);
  await fs.unlink(fullPath).catch(() => {});
}

export function resolveSupportImagePath(storageKey: string): string {
  if (storageKey.includes('/') || storageKey.includes('..') || storageKey.includes('\\')) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'invalid_storage_key' });
  }
  return path.join(supportDir(), storageKey);
}

export async function readSupportImage(
  storageKey: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const fullPath = resolveSupportImagePath(storageKey);
  try {
    const buffer = await fs.readFile(fullPath);
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !MIME_TO_EXT.has(detected.mime)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 500, { reason: 'stored_file_invalid' });
    }
    return { buffer, mimeType: detected.mime };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(ErrorCode.SUPPORT_ATTACHMENT_NOT_FOUND, 404);
  }
}
