import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

const tmpDir = path.join(os.tmpdir(), `mll-private-uploads-${Date.now()}`);

vi.mock('../../../../src/config/env.js', () => ({
  config: {
    PRIVATE_UPLOADS_DIR: tmpDir,
    SUPPORT_UPLOAD_MAX_BYTES: 2 * 1024 * 1024,
    SUPPORT_IMAGE_MAX_PX: 2048,
    SUPPORT_UPLOAD_MAX_FILES: 5,
  },
}));

const { sanitizeImageBuffer, saveSupportImage, deleteSupportImage } = await import(
  '../../../../src/common/lib/secure-image.js'
);
const { ErrorCode } = await import('@mll/shared');

beforeEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('secure-image', () => {
  it('accepts valid PNG and re-encodes', async () => {
    const input = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const result = await sanitizeImageBuffer(input);
    expect(result.mimeType).toBe('image/png');
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
    expect(result.data.byteLength).toBeGreaterThan(0);
  });

  it('accepts valid JPEG', async () => {
    const input = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 0, g: 128, b: 255 } },
    })
      .jpeg()
      .toBuffer();

    const result = await sanitizeImageBuffer(input);
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('rejects empty buffer', async () => {
    await expect(sanitizeImageBuffer(Buffer.alloc(0))).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('rejects non-image content', async () => {
    await expect(sanitizeImageBuffer(Buffer.from('not an image at all'))).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('rejects polyglot PNG header with trailing script after re-encode', async () => {
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const polyglot = Buffer.concat([png, Buffer.from('<script>alert(1)</script>')]);
    const result = await sanitizeImageBuffer(polyglot);
    expect(result.data.byteLength).toBeLessThan(polyglot.byteLength);
    expect(result.data.includes(Buffer.from('<script>'))).toBe(false);
  });

  it('rejects oversized dimensions', async () => {
    const input = await sharp({
      create: { width: 3000, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    await expect(sanitizeImageBuffer(input, { maxPx: 2048 })).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('saveSupportImage writes file with uuid name', async () => {
    const input = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .webp()
      .toBuffer();

    const saved = await saveSupportImage(input);
    expect(saved.storageKey).toMatch(/^[0-9a-f-]+\.webp$/);

    const fullPath = path.join(tmpDir, 'support', saved.storageKey);
    const onDisk = await fs.readFile(fullPath);
    expect(onDisk.byteLength).toBeGreaterThan(0);

    await deleteSupportImage(saved.storageKey);
    await expect(fs.stat(fullPath)).rejects.toThrow();
  });
});
