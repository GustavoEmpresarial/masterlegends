if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend?.();
      });
    }
  };
}

globalThis.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

globalThis.document = {
  createElement() {
    const canvas = { width: 1, height: 1, pixels: null };
    canvas.getContext = () => ({
      translate() {},
      scale() {},
      putImageData(imageData) {
        canvas.pixels = imageData.data;
      },
    });
    canvas.toBlob = (callback) => {
      callback(new Blob([encodePNG(canvas.width, canvas.height, canvas.pixels)]));
    };
    return canvas;
  },
};

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([len, name, data, crc]);
}

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  const src = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4);
    raw[row] = 0;
    src.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const STROKES = {
  C: [[6, 8, 34, 8], [6, 8, 6, 48], [6, 48, 34, 48], [34, 8, 34, 18], [34, 38, 34, 48]],
  H: [[8, 6, 8, 50], [32, 6, 32, 50], [8, 28, 32, 28]],
  A: [[6, 50, 20, 6], [34, 50, 20, 6], [10, 30, 30, 30]],
  M: [[6, 50, 6, 8], [6, 8, 20, 28], [34, 8, 20, 28], [34, 8, 34, 50]],
  P: [[8, 50, 8, 6], [8, 6, 32, 6], [32, 6, 32, 28], [8, 28, 32, 28]],
  I: [[12, 6, 28, 6], [20, 6, 20, 50], [12, 50, 28, 50]],
  O: [[8, 10, 8, 46], [8, 6, 32, 6], [32, 10, 32, 46], [8, 50, 32, 50]],
  N: [[8, 50, 8, 6], [8, 6, 32, 50], [32, 50, 32, 6]],
  S: [[32, 14, 32, 6], [8, 6, 32, 6], [8, 6, 8, 26], [8, 26, 32, 26], [32, 26, 32, 46], [8, 50, 32, 50], [8, 50, 8, 40]],
  '0': [[10, 8, 30, 8], [10, 48, 30, 48], [10, 8, 10, 48], [30, 8, 30, 48]],
  '1': [[20, 6, 20, 50], [12, 16, 20, 6], [10, 50, 30, 50]],
  '2': [[8, 12, 8, 6], [8, 6, 32, 6], [32, 6, 32, 26], [8, 26, 32, 26], [8, 26, 8, 50], [8, 50, 32, 50]],
  '3': [[8, 6, 32, 6], [32, 6, 32, 50], [8, 50, 32, 50], [12, 28, 32, 28]],
  '4': [[8, 6, 8, 28], [8, 28, 32, 28], [24, 6, 24, 50]],
  '5': [[32, 6, 8, 6], [8, 6, 8, 26], [8, 26, 32, 26], [32, 26, 32, 50], [32, 50, 8, 50]],
  '6': [[30, 8, 10, 8], [10, 8, 10, 48], [10, 48, 30, 48], [30, 48, 30, 28], [30, 28, 10, 28]],
  '7': [[8, 6, 32, 6], [32, 6, 16, 50]],
  '8': [[10, 6, 30, 6], [10, 50, 30, 50], [10, 6, 10, 50], [30, 6, 30, 50], [10, 28, 30, 28]],
  '9': [[30, 48, 10, 48], [30, 6, 30, 48], [10, 6, 30, 6], [10, 6, 10, 28], [10, 28, 30, 28]],
};

function hash(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function paint(w, h, draw) {
  const data = new Uint8Array(w * h * 4);
  const api = {
    w,
    h,
    fill(r, g, b) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    },
    px(x, y, r, g, b, a = 255) {
      const ix = x | 0;
      const iy = y | 0;
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) return;
      const i = (iy * w + ix) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    },
    rect(x, y, rw, rh, r, g, b) {
      const x0 = Math.max(0, x | 0);
      const y0 = Math.max(0, y | 0);
      const x1 = Math.min(w, (x + rw) | 0);
      const y1 = Math.min(h, (y + rh) | 0);
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * w + xx) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }
    },
    frame(x, y, rw, rh, t, r, g, b) {
      this.rect(x, y, rw, t, r, g, b);
      this.rect(x, y + rh - t, rw, t, r, g, b);
      this.rect(x, y, t, rh, r, g, b);
      this.rect(x + rw - t, y, t, rh, r, g, b);
    },
    line(x0, y0, x1, y1, rad, r, g, b) {
      const minX = Math.max(0, Math.floor(Math.min(x0, x1) - rad));
      const maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1) + rad));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1) - rad));
      const maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1) + rad));
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len2 = dx * dx + dy * dy || 1;
      const rad2 = rad * rad;
      for (let yy = minY; yy <= maxY; yy++) {
        for (let xx = minX; xx <= maxX; xx++) {
          const t = Math.max(0, Math.min(1, ((xx - x0) * dx + (yy - y0) * dy) / len2));
          const px = x0 + dx * t - xx;
          const py = y0 + dy * t - yy;
          if (px * px + py * py <= rad2) this.px(xx, yy, r, g, b);
        }
      }
    },
    text(label, x, y, scale, r, g, b) {
      let cursor = x;
      const weight = Math.max(2.2, scale * 0.16);
      for (const ch of label) {
        const strokes = STROKES[ch];
        if (!strokes) {
          cursor += 18 * scale;
          continue;
        }
        for (const [ax, ay, bx, by] of strokes) {
          this.line(cursor + ax * scale, y + ay * scale, cursor + bx * scale, y + by * scale, weight, r, g, b);
        }
        cursor += 46 * scale;
      }
    },
    star(cx, cy, outer, inner, points, r, g, b) {
      const poly = [];
      for (let i = 0; i < points * 2; i++) {
        const rad = i % 2 === 0 ? outer : inner;
        const a = -Math.PI / 2 + (i * Math.PI) / points;
        poly.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
      }
      const minX = Math.max(0, Math.floor(cx - outer));
      const maxX = Math.min(w - 1, Math.ceil(cx + outer));
      const minY = Math.max(0, Math.floor(cy - outer));
      const maxY = Math.min(h - 1, Math.ceil(cy + outer));
      for (let yy = minY; yy <= maxY; yy++) {
        for (let xx = minX; xx <= maxX; xx++) {
          let inside = false;
          for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const [xi, yi] = poly[i];
            const [xj, yj] = poly[j];
            if ((yi > yy) !== (yj > yy) && xx < ((xj - xi) * (yy - yi)) / (yj - yi) + xi) inside = !inside;
          }
          if (inside) this.px(xx, yy, r, g, b);
        }
      }
    },
  };
  draw(api);
  const row = w * 4;
  const flipped = new Uint8Array(data.length);
  for (let y = 0; y < h; y++) flipped.set(data.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  const texture = new THREE.DataTexture(flipped, w, h, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function std(name, props) {
  return new THREE.MeshStandardMaterial({ name, ...props });
}

function box(size, position, material, rotation) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function starShape(outer, inner, points) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function build() {
  const root = new THREE.Group();
  root.name = 'VestiarioChampions';

  const floorMap = paint(1024, 768, (p) => {
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        const n = hash(x, y);
        const grout = x % 128 < 3 || y % 96 < 3;
        const vein = Math.sin(x * 0.018 + y * 0.027) * 7 + Math.sin(x * 0.004 - y * 0.01) * 5;
        const base = grout ? 28 : 62 + n * 16 + vein;
        p.px(x, y, base * 0.92, base * 0.93, base + 4);
      }
    }
    p.frame(28, 28, p.w - 56, p.h - 56, 4, 214, 170, 78);
    p.frame(40, 40, p.w - 80, p.h - 80, 2, 140, 104, 48);
  });

  const carpetMap = paint(768, 384, (p) => {
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        const n = hash(x * 2, y * 2);
        const weave = ((x + y) & 4) === 0 ? 10 : 0;
        const edge = x < 18 || y < 18 || x > p.w - 19 || y > p.h - 19;
        if (edge) p.px(x, y, 196, 154, 64);
        else p.px(x, y, 10 + n * 8, 78 + weave + n * 28, 40 + n * 10);
      }
    }
    p.frame(28, 28, p.w - 56, p.h - 56, 3, 232, 196, 110);
  });

  const wallMap = paint(1024, 512, (p) => {
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        const n = hash(x, y);
        const upper = y < 250;
        const base = upper ? 34 + n * 8 : 22 + n * 6;
        p.px(x, y, base, base + 2, base + 10);
      }
    }
    p.rect(0, 248, p.w, 8, 214, 170, 78);
    p.rect(0, 0, p.w, 16, 214, 170, 78);
    for (let i = 0; i < 8; i++) {
      const x = 24 + i * 126;
      p.frame(x, 280, 108, 200, 3, 120, 96, 52);
      p.rect(x + 8, 288, 92, 184, 18, 20, 28);
    }
  });

  const doorMap = paint(256, 512, (p) => {
    p.fill(16, 18, 24);
    p.frame(8, 8, 240, 496, 7, 214, 170, 78);
    p.frame(28, 28, 200, 360, 3, 120, 96, 52);
    p.rect(36, 36, 184, 344, 28, 31, 40);
    p.rect(48, 430, 160, 10, 70, 74, 84);
    p.rect(48, 448, 160, 10, 70, 74, 84);
    p.rect(48, 466, 160, 10, 70, 74, 84);
    p.frame(196, 230, 22, 78, 3, 232, 196, 110);
    p.rect(202, 236, 10, 66, 160, 124, 58);
  });

  const leatherMap = paint(512, 128, (p) => {
    p.fill(28, 22, 20);
    for (let i = 0; i < 9; i++) {
      const x = 36 + i * 54;
      p.frame(x, 18, 40, 92, 2, 70, 52, 40);
      p.star(x + 20, 64, 5, 2.2, 5, 196, 154, 72);
    }
  });

  const signMap = paint(1024, 280, (p) => {
    p.fill(12, 16, 26);
    p.frame(8, 8, 1008, 264, 8, 214, 170, 78);
    p.frame(22, 22, 980, 236, 2, 120, 96, 52);
    for (let i = 0; i < 5; i++) p.star(372 + i * 70, 58, 16, 7, 5, 240, 198, 96);
    p.text('CHAMPIONS', 262, 96, 1.18, 240, 198, 96);
  });

  const black = std('Black', { color: '#1a1e27', roughness: 0.46, metalness: 0.42 });
  const gold = std('Gold', { color: '#e2bc62', roughness: 0.28, metalness: 0.94 });
  const brass = std('Brass', { color: '#b8893e', roughness: 0.34, metalness: 0.88 });
  const leather = std('Leather', { color: '#ffffff', map: leatherMap, roughness: 0.62, metalness: 0.04 });
  const stone = std('Stone', { color: '#ffffff', map: floorMap, roughness: 0.72, metalness: 0.08 });
  const carpet = std('Carpet', { color: '#ffffff', map: carpetMap, roughness: 0.96, metalness: 0 });
  const wall = std('Wall', { color: '#ffffff', map: wallMap, roughness: 0.86, metalness: 0.04 });
  const doorMat = std('LockerDoor', { color: '#ffffff', map: doorMap, roughness: 0.4, metalness: 0.35 });
  const signMat = std('Sign', { color: '#ffffff', map: signMap, roughness: 0.42, metalness: 0.2 });
  const warm = std('Lamp', { color: '#fff6dc', emissive: '#ffc56a', emissiveIntensity: 2.4, roughness: 0.28 });
  const inside = std('LockerInside', { color: '#3a2a1c', emissive: '#ffb15a', emissiveIntensity: 0.45, roughness: 0.8 });
  const navyCloth = std('NavyCloth', { color: '#17315f', roughness: 0.78 });
  const greenCloth = std('GreenCloth', { color: '#0f6a38', roughness: 0.78 });
  const whiteCloth = std('WhiteCloth', { color: '#f4f1ea', roughness: 0.74 });
  const towelWhite = std('Towel', { color: '#f7f4ee', roughness: 0.92 });
  const glass = std('Glass', { color: '#243140', roughness: 0.12, metalness: 0.72, transparent: true, opacity: 0.8 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 5.6), stone);
  floor.name = 'Floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -0.15);
  floor.receiveShadow = true;
  root.add(floor);

  const rug = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.035, 1.85), carpet);
  rug.name = 'Carpet';
  rug.position.set(0, 0.02, 0.18);
  rug.receiveShadow = true;
  root.add(rug);

  const medallion = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 48), gold);
  medallion.rotation.x = -Math.PI / 2;
  medallion.position.set(0, 0.045, -0.42);
  const star = new THREE.Mesh(starShape(0.22, 0.09, 5), gold);
  star.rotation.x = -Math.PI / 2;
  star.position.set(0, 0.05, -0.42);
  root.add(medallion, star);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 2.95), wall);
  back.name = 'BackWall';
  back.position.set(0, 1.48, -2.62);
  root.add(back);
  root.add(box([8.7, 3.05, 0.12], [0, 1.52, -2.72], black));
  root.add(box([0.14, 3.05, 5.6], [-4.28, 1.52, -0.15], black));
  root.add(box([0.14, 3.05, 5.6], [4.28, 1.52, -0.15], black));
  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.95), wall);
  sideL.position.set(-4.2, 1.48, -0.15);
  sideL.rotation.y = Math.PI / 2;
  const sideR = sideL.clone();
  sideR.position.x = 4.2;
  sideR.rotation.y = -Math.PI / 2;
  root.add(sideL, sideR);

  root.add(box([8.7, 0.08, 5.7], [0, 2.98, -0.15], black));
  root.add(box([8.2, 0.045, 0.08], [0, 2.78, -2.5], gold));
  root.add(box([0.08, 0.045, 5.2], [-4.05, 2.78, -0.15], gold));
  root.add(box([0.08, 0.045, 5.2], [4.05, 2.78, -0.15], gold));

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.55, 0.62), signMat);
  sign.name = 'ChampionsSign';
  sign.position.set(0, 2.52, -2.5);
  root.add(sign);

  const numbers = ['1', '7', '9', '10', '11', '14', '17', '19', '21', '23'];
  const openAt = new Set([1, 4, 7]);
  const kits = [whiteCloth, greenCloth, navyCloth];
  root.add(box([7.55, 0.08, 0.5], [0, 0.05, -2.28], black));
  root.add(box([7.55, 0.045, 0.52], [0, 0.1, -2.28], gold));
  root.add(box([7.62, 0.08, 0.5], [0, 2.12, -2.28], black));
  root.add(box([7.62, 0.035, 0.52], [0, 2.17, -2.28], gold));

  numbers.forEach((num, index) => {
    const x = -3.32 + index * 0.74;
    const open = openAt.has(index);
    root.add(box([0.7, 1.96, 0.36], [x, 1.12, -2.3], black));
    if (open) {
      root.add(box([0.52, 1.7, 0.04], [x, 1.14, -2.14], inside));
      const jerseyMat = kits[index % kits.length];
      const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 8), brass);
      hanger.rotation.z = Math.PI / 2;
      hanger.position.set(x, 1.72, -2.12);
      root.add(hanger);
      root.add(box([0.28, 0.36, 0.04], [x, 1.4, -2.12], jerseyMat));
      root.add(box([0.12, 0.1, 0.035], [x - 0.18, 1.52, -2.12], jerseyMat, [0, 0, 0.6]));
      root.add(box([0.12, 0.1, 0.035], [x + 0.18, 1.52, -2.12], jerseyMat, [0, 0, -0.6]));
      const plateNum = paint(128, 128, (p) => {
        p.fill(jerseyMat.color.r * 255, jerseyMat.color.g * 255, jerseyMat.color.b * 255);
        const label = num.length > 2 ? num.slice(0, 2) : num;
        const start = label.length === 1 ? 40 : 16;
        p.text(label, start, 34, 0.85, 248, 244, 236);
      });
      const badge = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.16),
        std(`Jersey${num}`, { map: plateNum, roughness: 0.7 }),
      );
      badge.position.set(x, 1.36, -2.09);
      root.add(badge);
    }
    const hinge = new THREE.Group();
    hinge.position.set(x - 0.3, 1.12, -2.1);
    if (open) hinge.rotation.y = -1.05;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.82, 0.035), doorMat);
    door.position.set(0.3, 0, 0.02);
    hinge.add(door);
    const plateMap = paint(160, 72, (p) => {
      p.fill(226, 184, 92);
      p.frame(4, 4, 152, 64, 3, 90, 64, 24);
      const start = num.length === 1 ? 58 : 28;
      p.text(num, start, 12, 0.72, 28, 22, 16);
    });
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.1),
      std(`Plate${num}`, { map: plateMap, roughness: 0.35, metalness: 0.65 }),
    );
    plate.position.set(0.3, 0.62, 0.045);
    hinge.add(plate);
    root.add(hinge);
  });

  root.add(box([5.3, 0.42, 0.42], [0, 0.28, -1.08], black));
  const seat = box([5.15, 0.1, 0.5], [0, 0.52, -1.08], leather);
  root.add(seat);
  root.add(box([5.15, 0.025, 0.02], [0, 0.58, -0.84], gold));
  for (const x of [-2.35, 2.35]) root.add(box([0.08, 0.5, 0.36], [x, 0.25, -1.08], brass));
  root.add(box([0.42, 0.02, 0.2], [-1.2, 0.585, -1.06], towelWhite));
  root.add(box([0.4, 0.018, 0.2], [1.15, 0.582, -1.08], navyCloth));

  const bootColors = ['#f4f1ea', '#111827', '#c9a227', '#0f6a38'];
  bootColors.forEach((color, i) => {
    const mat = std(`Boot${i}`, { color, roughness: 0.55, metalness: 0.08 });
    const x = -1.7 + i * 1.15;
    root.add(box([0.16, 0.07, 0.28], [x - 0.08, 0.05, -0.78], mat));
    root.add(box([0.16, 0.07, 0.28], [x + 0.08, 0.05, -0.74], mat));
  });

  for (const [x, z] of [[-2.15, 0.15], [0, 0.35], [2.15, 0.15]]) {
    const cord = box([0.012, 0.28, 0.012], [x, 2.84, z], black);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.07, 20), brass);
    cap.position.set(x, 2.68, z);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), warm);
    bulb.position.set(x, 2.58, z);
    root.add(cord, cap, bulb);
  }

  const pedestal = new THREE.Group();
  pedestal.position.set(-3.55, 0, -0.85);
  pedestal.add(box([0.46, 0.72, 0.46], [0, 0.36, 0], black));
  pedestal.add(box([0.5, 0.04, 0.5], [0, 0.74, 0], gold));
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.16, 20), gold);
  cup.position.set(0, 0.96, 0);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 12), gold);
  stem.position.set(0, 0.84, 0);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.04, 16), gold);
  foot.position.set(0, 0.78, 0);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 20), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 1.04, 0);
  for (const side of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 8, 16), gold);
    handle.position.set(side * 0.13, 0.96, 0);
    pedestal.add(handle);
  }
  const plaqueMap = paint(128, 48, (p) => {
    p.fill(226, 184, 92);
    p.text('MLL', 22, 4, 0.62, 28, 22, 16);
  });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.1), std('MLL', { map: plaqueMap, metalness: 0.7, roughness: 0.3 }));
  plaque.position.set(0, 0.42, 0.24);
  pedestal.add(cup, stem, foot, rim, plaque);
  root.add(pedestal);

  const rack = new THREE.Group();
  rack.position.set(3.55, 0, -0.7);
  rack.add(box([0.06, 1.7, 0.06], [0, 0.85, 0], brass));
  rack.add(box([0.7, 0.04, 0.04], [0, 1.62, 0], brass));
  [whiteCloth, greenCloth, navyCloth].forEach((mat, i) => {
    const x = -0.22 + i * 0.22;
    rack.add(box([0.16, 0.28, 0.03], [x, 1.38, 0], mat));
  });
  root.add(rack);

  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.35), glass);
  mirror.position.set(3.95, 1.45, 0.85);
  mirror.rotation.y = -Math.PI / 2;
  root.add(mirror);
  root.add(box([0.04, 1.5, 0.84], [4.02, 1.45, 0.85], gold));

  root.add(box([0.06, 2.15, 0.92], [4.16, 1.15, 1.35], black));
  root.add(box([0.03, 0.08, 0.72], [4.12, 1.15, 1.35], gold));

  return root;
}

const outFile = join(dirname(fileURLToPath(import.meta.url)), '../public/ui/vestiario/models/vestiario-champions.glb');
mkdirSync(dirname(outFile), { recursive: true });
const exporter = new GLTFExporter();
const bin = await exporter.parseAsync(build(), { binary: true, maxTextureSize: 1024 });
writeFileSync(outFile, Buffer.from(bin));
console.log(outFile, Buffer.from(bin).byteLength);
