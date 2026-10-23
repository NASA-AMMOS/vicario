// Report visuals drawn on ImageProbe previews (PNG): outlines of the region or
// sample grid an operation selected, so a reviewer can see what was cut out.
import { readFileSync, writeFileSync } from 'node:fs';
import type { TestInfo } from '@playwright/test';
import { PNG } from 'pngjs';

export interface Rect { x: number; y: number; width: number; height: number }

const RED = [230, 30, 40, 255];

function setPixel(png: PNG, x: number, y: number, rgba = RED) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = (png.width * y + x) << 2;
  for (let c = 0; c < 4; c++) png.data[i + c] = rgba[c];
}

/** Scale a small preview up so one-pixel outlines stay visible. */
function upscale(src: PNG, factor: number): PNG {
  const out = new PNG({ width: src.width * factor, height: src.height * factor });
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const si = (src.width * Math.floor(y / factor) + Math.floor(x / factor)) << 2;
      src.data.copy(out.data, (out.width * y + x) << 2, si, si + 4);
    }
  }
  return out;
}

/**
 * Attach a copy of `previewPng` with the given rectangles outlined and,
 * optionally, single pixels marked (e.g. the subsampling grid).
 */
export async function attachOverlay(testInfo: TestInfo, name: string, previewPng: string,
  rects: Rect[], points: Array<[number, number]> = []) {
  const src = PNG.sync.read(readFileSync(previewPng));
  const factor = Math.max(1, Math.min(8, Math.floor(320 / Math.max(src.width, src.height))));
  const png = upscale(src, factor);
  for (const r of rects) {
    const [x0, y0] = [r.x * factor, r.y * factor];
    const [x1, y1] = [(r.x + r.width) * factor - 1, (r.y + r.height) * factor - 1];
    for (let t = 0; t < 2; t++) {
      for (let x = x0; x <= x1; x++) { setPixel(png, x, y0 + t); setPixel(png, x, y1 - t); }
      for (let y = y0; y <= y1; y++) { setPixel(png, x0 + t, y); setPixel(png, x1 - t, y); }
    }
  }
  for (const [px, py] of points) {
    const cx = px * factor + Math.floor(factor / 2);
    const cy = py * factor + Math.floor(factor / 2);
    setPixel(png, cx, cy);
    setPixel(png, cx + 1, cy);
    setPixel(png, cx, cy + 1);
    setPixel(png, cx + 1, cy + 1);
  }
  const out = testInfo.outputPath(`${name.replace(/[^\w.-]+/g, '_')}.png`);
  writeFileSync(out, PNG.sync.write(png));
  await testInfo.attach(`${name} preview`, { path: out, contentType: 'image/png' });
}
