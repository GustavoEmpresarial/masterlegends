import { AppError, ErrorCode } from './errors.js';

export interface MultipartFilePart {
  buffer: Buffer;
  mime: string;
  fieldname: string;
}

export interface MultipartResult {
  fields: Record<string, string>;
  files: MultipartFilePart[];
}

interface MultipartPart {
  type: string;
  fieldname: string;
  mimetype?: string;
  value?: unknown;
  toBuffer: () => Promise<Buffer>;
}

export async function consumeMultipart(
  req: { parts: () => AsyncIterable<MultipartPart> },
  opts?: { maxFiles?: number },
): Promise<MultipartResult> {
  const maxFiles = opts?.maxFiles ?? 5;
  const fields: Record<string, string> = {};
  const files: MultipartFilePart[] = [];

  for await (const part of req.parts()) {
    if (part.type === 'file') {
      if (files.length >= maxFiles) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
          reason: 'too_many_files',
          max: maxFiles,
        });
      }
      const buffer = await part.toBuffer();
      files.push({
        buffer,
        mime: part.mimetype ?? 'application/octet-stream',
        fieldname: part.fieldname,
      });
    } else if (part.type === 'field' && typeof part.value === 'string') {
      fields[part.fieldname] = part.value;
    }
  }

  return { fields, files };
}
