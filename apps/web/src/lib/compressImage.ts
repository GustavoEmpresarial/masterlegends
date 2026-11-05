const MAX_DIMENSION = 1920;
const COMPRESS_THRESHOLD = 1024 * 1024;
const JPEG_QUALITY = 0.85;

function inferMimeFromName(name: string): string | null {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return null;
}

export function resolveImageMime(file: File): string | null {
  if (file.type && ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return file.type;
  }
  return inferMimeFromName(file.name);
}

export function isAcceptedImage(file: File): boolean {
  return resolveImageMime(file) !== null;
}

/** Resize/compress large images via canvas before upload. */
export async function compressImageForUpload(file: File): Promise<File> {
  const mime = resolveImageMime(file);
  if (!mime || file.size <= COMPRESS_THRESHOLD) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const outputMime = mime === 'image/png' ? 'image/jpeg' : mime;
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, outputMime, JPEG_QUALITY);
  });
  if (!blob || blob.size >= file.size) return file;

  const ext = outputMime === 'image/jpeg' ? '.jpg' : outputMime === 'image/webp' ? '.webp' : '.png';
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${baseName}${ext}`, { type: outputMime, lastModified: Date.now() });
}

export async function compressImagesForUpload(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => compressImageForUpload(f)));
}
