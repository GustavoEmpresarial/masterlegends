import sharp from 'sharp';
import { overwallBand } from '@mll/shared';
import type { BonecoCardStats } from './boneco.prompt.js';

const GLYPH_W = 14;
const GLYPH_H = 16;
const GLYPHS: Record<string, number[]> = {
  A: [0, 1792, 1920, 3968, 3456, 7616, 7616, 8160, 14560, 14432, 0, 0, 0, 0, 0, 0],
  B: [0, 8064, 7616, 7616, 7616, 8064, 7360, 7360, 7360, 8064, 0, 0, 0, 0, 0, 0],
  C: [0, 1984, 7232, 7168, 6144, 14336, 6144, 7168, 7232, 1984, 0, 0, 0, 0, 0, 0],
  D: [0, 8064, 7616, 7392, 7264, 7264, 7264, 7392, 7616, 8064, 0, 0, 0, 0, 0, 0],
  E: [0, 8064, 7168, 7168, 7168, 8064, 7168, 7168, 7168, 8064, 0, 0, 0, 0, 0, 0],
  F: [0, 8064, 7168, 7168, 7168, 8064, 7168, 7168, 7168, 7168, 0, 0, 0, 0, 0, 0],
  G: [0, 2016, 7776, 7168, 6144, 14816, 6240, 7264, 7264, 2016, 0, 0, 0, 0, 0, 0],
  H: [0, 7264, 7264, 7264, 7264, 8160, 7264, 7264, 7264, 7264, 0, 0, 0, 0, 0, 0],
  I: [0, 7168, 7168, 7168, 7168, 7168, 7168, 7168, 7168, 7168, 0, 0, 0, 0, 0, 0],
  J: [0, 7168, 7168, 7168, 7168, 7168, 7168, 7168, 7168, 7168, 6144, 12288, 0, 0, 0, 0],
  K: [0, 7392, 7616, 8064, 7936, 7680, 7936, 8064, 7616, 7392, 0, 0, 0, 0, 0, 0],
  L: [0, 7168, 7168, 7168, 7168, 7168, 7168, 7168, 7168, 8064, 0, 0, 0, 0, 0, 0],
  M: [0, 7224, 7800, 7800, 8184, 7128, 7128, 6552, 6168, 6168, 0, 0, 0, 0, 0, 0],
  N: [0, 7264, 7776, 7776, 8032, 7008, 7136, 6624, 6624, 6368, 0, 0, 0, 0, 0, 0],
  O: [0, 4032, 7392, 6240, 6256, 14448, 6256, 6240, 7392, 4032, 0, 0, 0, 0, 0, 0],
  P: [0, 8064, 7616, 7360, 7360, 7616, 8064, 7168, 7168, 7168, 0, 0, 0, 0, 0, 0],
  Q: [0, 4032, 7392, 6240, 6256, 14448, 6256, 6240, 7392, 4032, 448, 224, 0, 0, 0, 0],
  R: [0, 8064, 7616, 7616, 7616, 8064, 7616, 7616, 7392, 7392, 0, 0, 0, 0, 0, 0],
  S: [0, 3968, 6272, 6144, 7680, 8064, 1984, 448, 4544, 8064, 0, 0, 0, 0, 0, 0],
  T: [0, 16320, 1536, 1536, 1536, 1536, 1536, 1536, 1536, 1536, 0, 0, 0, 0, 0, 0],
  U: [0, 7392, 7392, 7392, 7392, 7392, 7392, 7392, 7360, 3968, 0, 0, 0, 0, 0, 0],
  V: [0, 14432, 14560, 6368, 7360, 7616, 3456, 3968, 1920, 1792, 0, 0, 0, 0, 0, 0],
  W: [0, 14798, 6606, 6604, 7660, 8060, 8060, 3964, 3896, 3640, 0, 0, 0, 0, 0, 0],
  X: [0, 14560, 7616, 3968, 3968, 1792, 3968, 4032, 7616, 14560, 0, 0, 0, 0, 0, 0],
  Y: [0, 14560, 6592, 7552, 3968, 1792, 1792, 1792, 1792, 1792, 0, 0, 0, 0, 0, 0],
  Z: [0, 16320, 448, 960, 1920, 1792, 3584, 7680, 15360, 16320, 0, 0, 0, 0, 0, 0],
  '0': [0, 3840, 7552, 6592, 6592, 14784, 6592, 6592, 7552, 3840, 0, 0, 0, 0, 0, 0],
  '1': [0, 7936, 1792, 1792, 1792, 1792, 1792, 1792, 1792, 8128, 0, 0, 0, 0, 0, 0],
  '2': [0, 3840, 4992, 384, 384, 896, 1792, 3584, 7168, 8064, 0, 0, 0, 0, 0, 0],
  '3': [0, 3840, 4992, 384, 896, 3840, 896, 448, 4992, 7936, 0, 0, 0, 0, 0, 0],
  '4': [0, 896, 1920, 3968, 8064, 7040, 13184, 16320, 896, 896, 0, 0, 0, 0, 0, 0],
  '5': [0, 8064, 6144, 6144, 7936, 896, 448, 448, 896, 7936, 0, 0, 0, 0, 0, 0],
  '6': [0, 1920, 7168, 6144, 8064, 7616, 6592, 6592, 7552, 3840, 0, 0, 0, 0, 0, 0],
  '7': [0, 8128, 384, 896, 896, 1792, 1792, 1536, 3584, 3072, 0, 0, 0, 0, 0, 0],
  '8': [0, 3968, 7552, 6592, 7552, 3968, 6528, 6592, 6592, 3968, 0, 0, 0, 0, 0, 0],
  '9': [0, 3840, 6528, 6528, 6592, 6592, 4032, 384, 896, 7936, 0, 0, 0, 0, 0, 0],
};

const BG: readonly [number, number, number] = [2, 16, 62];
const TRACK: readonly [number, number, number] = [8, 36, 110];
const FILL: readonly [number, number, number] = [64, 186, 255];
const INK: readonly [number, number, number] = [255, 255, 255];

const CELLS = [
  { x: 148, y: 772, w: 214, h: 70, label: 'STRENGTH', key: 'strength' },
  { x: 458, y: 772, w: 222, h: 70, label: 'SPEED', key: 'speed' },
  { x: 148, y: 848, w: 214, h: 70, label: 'STAMINA', key: 'stamina' },
  { x: 458, y: 848, w: 222, h: 70, label: 'PERFORMANCE', key: 'performance' },
] as const;

function glyphInkWidth(ch: string): number {
  const rows = GLYPHS[ch];
  if (!rows) return 4;
  let max = 0;
  for (const bits of rows) {
    for (let x = 0; x < GLYPH_W; x += 1) {
      if (bits & (1 << (GLYPH_W - 1 - x))) max = Math.max(max, x + 1);
    }
  }
  return Math.max(3, max);
}

function textWidth(value: string): number {
  let width = 0;
  for (const ch of value) width += glyphInkWidth(ch) + 1;
  return width;
}

function put(data: Buffer, width: number, channels: number, x: number, y: number, height: number, rgb: readonly [number, number, number]) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const i = (y * width + x) * channels;
  data[i] = rgb[0];
  data[i + 1] = rgb[1];
  data[i + 2] = rgb[2];
  if (channels === 4) data[i + 3] = 255;
}

function fillRect(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: readonly [number, number, number],
) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(width, x + w);
  const y1 = Math.min(height, y + h);
  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) put(data, width, channels, xx, yy, height, rgb);
  }
}

function drawText(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  x: number,
  y: number,
  value: string,
  rgb: readonly [number, number, number],
) {
  let cursor = x;
  for (const ch of value) {
    const rows = GLYPHS[ch];
    if (rows) {
      for (let gy = 0; gy < GLYPH_H; gy += 1) {
        const bits = rows[gy] ?? 0;
        for (let gx = 0; gx < GLYPH_W; gx += 1) {
          if (bits & (1 << (GLYPH_W - 1 - gx))) put(data, width, channels, cursor + gx, y + gy, height, rgb);
        }
      }
    }
    cursor += glyphInkWidth(ch) + 1;
  }
}

function brightRatio(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  let bright = 0;
  let total = 0;
  const x1 = Math.min(width, x + w);
  const y1 = Math.min(height, y + h);
  for (let yy = Math.max(0, y); yy < y1; yy += 2) {
    for (let xx = Math.max(0, x); xx < x1; xx += 2) {
      const i = (yy * width + xx) * channels;
      total += 1;
      if (data[i]! > 190 && data[i + 1]! > 190 && data[i + 2]! > 190) bright += 1;
    }
  }
  return total === 0 ? 0 : bright / total;
}

/** Fills the four meter tracks and seats each number on its bar. */
export async function paintBonecoStats(
  input: Buffer,
  stats: BonecoCardStats,
  rarityIndex: number,
): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  const { width, height, channels } = info;
  const sx = width / 768;
  const sy = height / 1024;
  const hi = overwallBand(rarityIndex)[1];

  for (const cell of CELLS) {
    let x = Math.round(cell.x * sx);
    const y = Math.round(cell.y * sy);
    let w = Math.round(cell.w * sx);
    const h = Math.round(cell.h * sy);
    const extend = Math.round(88 * sx);
    if (brightRatio(pixels, width, height, channels, x - extend, y, extend, h) > 0.06) {
      x -= extend;
      w += extend;
    }
    fillRect(pixels, width, height, channels, x, y, w, h, BG);

    const value = stats[cell.key];
    drawText(pixels, width, height, channels, x + Math.round(6 * sx), y + Math.round(2 * sy), cell.label, INK);

    const barX = x + Math.round(6 * sx);
    const barY = y + Math.round(26 * sy);
    const barH = Math.max(8, Math.round(16 * sy));
    const barW = w - Math.round(12 * sx);
    const number = String(value);
    const numberW = textWidth(number);
    const room = Math.max(8, barW - numberW - 8);
    const fillW = Math.max(6, Math.round(room * Math.min(1, value / hi)));
    fillRect(pixels, width, height, channels, barX, barY, barW, barH, TRACK);
    fillRect(pixels, width, height, channels, barX, barY, fillW, barH, FILL);
    drawText(pixels, width, height, channels, barX + barW - numberW, barY - 2, number, INK);
  }

  return sharp(pixels, { raw: { width, height, channels } }).jpeg({ quality: 90 }).toBuffer();
}
