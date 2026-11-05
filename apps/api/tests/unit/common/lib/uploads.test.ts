import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmpDir = path.join(os.tmpdir(), `mll-uploads-${Date.now()}`);

vi.mock('../../../../src/config/env.js', () => ({
  config: {
    UPLOADS_DIR: tmpDir,
    UPLOADS_PUBLIC_PATH: '/uploads',
    UPLOAD_MAX_BYTES: 2 * 1024 * 1024,
  },
}));

const { saveItemImage, deleteItemImage } = await import(
  '../../../../src/common/lib/uploads.js'
);
const { config } = await import('../../../../src/config/env.js');

beforeEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('saveItemImage', () => {
  it('rejects unsupported MIME', async () => {
    await expect(saveItemImage(Buffer.from('x'), 'image/gif')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects buffers above UPLOAD_MAX_BYTES', async () => {
    const big = Buffer.alloc(config.UPLOAD_MAX_BYTES + 1);
    await expect(saveItemImage(big, 'image/png')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('saves PNG and returns public URL', async () => {
    const { url, filename } = await saveItemImage(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/png');
    expect(filename).toMatch(/\.png$/);
    expect(url).toMatch(/^\/uploads\/items\/.+\.png$/);

    const full = path.join(tmpDir, 'items', filename);
    const stat = await fs.stat(full);
    expect(stat.size).toBe(4);
  });

  it('saves JPEG with .jpg extension', async () => {
    const { filename } = await saveItemImage(Buffer.from([0xff, 0xd8]), 'image/jpeg');
    expect(filename).toMatch(/\.jpg$/);
  });
});

describe('deleteItemImage', () => {
  it('removes a previously saved image', async () => {
    const { url, filename } = await saveItemImage(Buffer.from([1, 2, 3]), 'image/webp');
    await deleteItemImage(url);
    await expect(fs.stat(path.join(tmpDir, 'items', filename))).rejects.toThrow();
  });

  it('is a no-op for null/empty url', async () => {
    await expect(deleteItemImage(null)).resolves.toBeUndefined();
    await expect(deleteItemImage('')).resolves.toBeUndefined();
  });

  it('rejects path traversal attempts', async () => {
    await expect(
      deleteItemImage('/uploads/items/../../etc/passwd'),
    ).resolves.toBeUndefined();
  });
});
