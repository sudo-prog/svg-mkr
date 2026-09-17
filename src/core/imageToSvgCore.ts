/*
 * imageToSvgCore.ts — SVG_MKR v2
 *
 * Pure TypeScript pipeline: raster image → processed PNG + traced SVG.
 * No React, no Tailwind, no DOM beyond a single off-screen canvas.
 *
 * Extracted & polished from 3DDD Studio v1's ImageEditor.tsx:
 *   - frequency-based color quantization (colorMap)
 *   - halftone dot-pattern
 *   - threshold binarization
 *   - hue-rotate / saturate / grayscale / invert CSS filters
 *   - magic-wand flood-fill (background removal)
 *   - freehand eraser
 * Plus ImageTracer.js SVG tracing on the final processed canvas.
 */

import ImageTracer from 'imagetracerjs';

// ── Interfaces ────────────────────────────────────────────────────────────

/**
 * Options controlling the full processing pipeline.
 * - colorCount: 1 = pure black, 2 = B&W, 3..10 = increasing palette size.
 * - hue / saturation: applied as CSS filter hue-rotate / saturate.
 * - grayscale: force luminance grayscale.
 * - invert: invert colors after filters.
 * - threshold: 0..255; null = off.  Binarizes to black/white.
 * - halftone: dot-pattern dithering; mutually exclusive-ish with threshold.
 * - halftoneSize: dot cell size in px (2..20).
 * - deletedColors: indices into the quantized palette to make transparent.
 * - paletteOverrides: explicit palette colors; if provided overrides auto-detection.
 */
export interface ProcessOptions {
  colorCount: number;        // 1..10
  hue: number;               // -180..180 degrees
  saturation: number;        // 0..200 percent
  grayscale: boolean;
  invert: boolean;
  threshold: number | null;  // 0..255 or null
  halftone: boolean;
  halftoneSize: number;      // 2..20
  deletedColors: number[];   // palette indices → transparent
  paletteOverrides?: { r: number; g: number; b: number }[];
}

export interface ProcessResult {
  pngDataUrl: string;     // processed canvas as PNG data URL
  svgString: string;      // traced SVG (ImageTracer.js)
  palette: { r: number; g: number; b: number }[];
}

// ── Small helpers ─────────────────────────────────────────────────────────

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const int = parseInt(n, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toByte = (n: number) => Math.max(0, Math.min(255, Math.round(n))) & 0xff;
  return `#${((1 << 24) + (toByte(r) << 16) + (toByte(g) << 8) + toByte(b)).toString(16).slice(1).toUpperCase()}`;
}

/** Load a data-URL / URL / File into an HTMLImageElement. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'Anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Create an off-screen canvas. Returns null if canvas unsupported. */
export function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

// ── Quantize ──────────────────────────────────────────────────────────────
// Frequency-based: down-sample, histogram into 16³ color buckets,
// sort by frequency, prune near-duplicates, limit to colorCount.

export function quantize(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colorCount: number,
  hue: number,
  saturation: number,
  grayscale: boolean,
  invert: boolean,
  paletteOverrides?: { r: number; g: number; b: number }[],
): { r: number; g: number; b: number }[] {
  // Build a composite-filtered, down-sampled copy for histogram.
  const MAX_HIST = 100;
  const scale = Math.min(1, MAX_HIST / Math.max(width, height));
  const sw = Math.max(1, Math.floor(width * scale));
  const sh = Math.max(1, Math.floor(height * scale));

  const small = createCanvas(sw, sh);
  if (!small) return [];
  const sCtx = small.getContext('2d', { willReadFrequently: true });
  if (!sCtx) return [];

  let filterStr = `hue-rotate(${hue}deg) saturate(${saturation}%)`;
  if (grayscale) filterStr += ' grayscale(100%)';
  if (invert) filterStr += ' invert(100%)';
  sCtx.filter = filterStr;
  sCtx.drawImage(ctx.canvas, 0, 0, sw, sh);
  sCtx.filter = 'none';

  const data = sCtx.getImageData(0, 0, sw, sh).data;

  if (paletteOverrides && paletteOverrides.length > 0) {
    return paletteOverrides.slice(0, Math.max(1, Math.min(10, colorCount)));
  }

  const colorMap = new Map<
    number,
    { r: number; g: number; b: number; count: number }
  >();

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // skip transparent
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = (Math.floor(r / 16) << 16) | (Math.floor(g / 16) << 8) | Math.floor(b / 16);
    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { r, g, b, count: 1 });
    }
  }

  const sorted = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
  const palette: { r: number; g: number; b: number }[] = [];
  const target = Math.max(1, Math.min(10, colorCount));

  for (const c of sorted) {
    if (palette.length >= target) break;
    let tooClose = false;
    for (const p of palette) {
      const dist = Math.sqrt((c.r - p.r) ** 2 + (c.g - p.g) ** 2 + (c.b - p.b) ** 2);
      if (dist < 30) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) palette.push({ r: c.r, g: c.g, b: c.b });
  }

  // Fill remaining slots if we have fewer than target.
  for (const c of sorted) {
    if (palette.length >= target) break;
    if (!palette.find(p => p.r === c.r && p.g === c.g && p.b === c.b)) {
      palette.push({ r: c.r, g: c.g, b: c.b });
    }
  }

  // colorCount === 1 → pure black.
  if (target === 1 && palette.length > 0) {
    return [{ r: 0, g: 0, b: 0 }];
  }

  return palette;
}

// ── Halftone ──────────────────────────────────────────────────────────────

export function applyHalftone(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  size: number,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      let total = 0;
      let count = 0;
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          if (x + dx < width && y + dy < height) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            total += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            count++;
          }
        }
      }
      const avg = total / count;
      const radius = (1 - avg / 255) * (size / 2);

      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          if (x + dx < width && y + dy < height) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            const dist = Math.sqrt((dx - size / 2) ** 2 + (dy - size / 2) ** 2);
            const isDot = dist < radius;
            const color = isDot ? 0 : 255;
            data[idx] = color;
            data[idx + 1] = color;
            data[idx + 2] = color;
          }
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// ── Threshold (binarize) ───────────────────────────────────────────────────

export function applyThreshold(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  threshold: number,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const v = avg >= threshold ? 255 : 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
}

// ── Magic wand flood-fill (background removal) ─────────────────────────────

export function floodFill(
  baseCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  startX: number,
  startY: number,
  tolerance: number,
): void {
  const imgData = baseCtx.getImageData(0, 0, width, height);
  const data = imgData.data;

  startX = Math.floor(startX);
  startY = Math.floor(startY);
  const startPos = (startY * width + startX) * 4;
  const startR = data[startPos];
  const startG = data[startPos + 1];
  const startB = data[startPos + 2];
  const startA = data[startPos + 3];

  if (startA === 0) return;

  const match = (pos: number) => {
    const r = data[pos];
    const g = data[pos + 1];
    const b = data[pos + 2];
    const a = data[pos + 3];
    if (a === 0) return false;
    return (
      Math.abs(r - startR) <= tolerance &&
      Math.abs(g - startG) <= tolerance &&
      Math.abs(b - startB) <= tolerance &&
      Math.abs(a - startA) <= tolerance
    );
  };

  const stack: [number, number][] = [[startX, startY]];
  const seen = new Uint8Array(width * height);

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    let y1 = y;
    while (y1 >= 0 && match((y1 * width + x) * 4)) y1--;
    y1++;

    let spanLeft = false;
    let spanRight = false;

    while (y1 < height && match((y1 * width + x) * 4)) {
      const pos = (y1 * width + x) * 4;
      data[pos + 3] = 0;
      seen[y1 * width + x] = 1;

      if (!spanLeft && x > 0 && match((y1 * width + (x - 1)) * 4) && !seen[y1 * width + (x - 1)]) {
        stack.push([x - 1, y1]);
        spanLeft = true;
      } else if (spanLeft && x > 0 && !match((y1 * width + (x - 1)) * 4)) {
        spanLeft = false;
      }

      if (!spanRight && x < width - 1 && match((y1 * width + (x + 1)) * 4) && !seen[y1 * width + (x + 1)]) {
        stack.push([x + 1, y1]);
        spanRight = true;
      } else if (spanRight && x < width - 1 && !match((y1 * width + (x + 1)) * 4)) {
        spanRight = false;
      }
      y1++;
    }
  }
  baseCtx.putImageData(imgData, 0, 0);
}

// ── Freehand eraser ───────────────────────────────────────────────────────

export function eraseAt(
  baseCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brushSize: number,
): void {
  baseCtx.globalCompositeOperation = 'destination-out';
  baseCtx.beginPath();
  baseCtx.arc(x, y, brushSize, 0, Math.PI * 2);
  baseCtx.fill();
  baseCtx.globalCompositeOperation = 'source-over';
}

// ── Core pipeline ──────────────────────────────────────────────────────────

const MAX_DIM = 1024;

/**
 * Full pipeline: load → constrain size → filter → quantize →
 * (threshold|halftone) → quantize-map → SVG trace.
 *
 * `source` may be a data-URL, blob-URL, or remote URL.
 */
export async function processImage(
  source: string,
  options: ProcessOptions,
): Promise<ProcessResult> {
  const img = await loadImage(source);

  let width = img.width;
  let height = img.height;
  const ratio = Math.min(MAX_DIM / width, MAX_DIM / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  // Base canvas (holds the raw image + any erasures/wand applied upstream).
  const baseCanvas = createCanvas(width, height) as HTMLCanvasElement;
  const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  baseCtx.drawImage(img, 0, 0, width, height);

  // Display/edited canvas.
  const canvas = createCanvas(width, height) as HTMLCanvasElement;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;

  ctx.clearRect(0, 0, width, height);
  let filterStr = `hue-rotate(${options.hue}deg) saturate(${options.saturation}%)`;
  if (options.grayscale) filterStr += ' grayscale(100%)';
  if (options.invert) filterStr += ' invert(100%)';
  ctx.filter = filterStr;
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.filter = 'none';

  // Quantize to build the palette.
  const useQuantize = options.colorCount > 0;
  let palette: { r: number; g: number; b: number }[] = [];

  if (useQuantize) {
    palette = quantize(
      ctx,
      width,
      height,
      options.colorCount,
      options.hue,
      options.saturation,
      options.grayscale,
      options.invert,
      options.paletteOverrides,
    );

    if (palette.length > 0) {
      // Map every pixel to nearest palette color (or transparent if deleted).
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        let minDist = Infinity;
        let bestIdx = 0;
        for (let j = 0; j < palette.length; j++) {
          const p = palette[j];
          const dist = (r - p.r) ** 2 + (g - p.g) ** 2 + (b - p.b) ** 2;
          if (dist < minDist) {
            minDist = dist;
            bestIdx = j;
          }
        }
        if (options.deletedColors.includes(bestIdx)) {
          data[i + 3] = 0;
        } else {
          data[i] = palette[bestIdx].r;
          data[i + 1] = palette[bestIdx].g;
          data[i + 2] = palette[bestIdx].b;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }
  }

  // Threshold or halftone (post-quantize, operates on display canvas).
  if (options.threshold !== null) {
    applyThreshold(ctx, width, height, options.threshold);
  } else if (options.halftone) {
    applyHalftone(ctx, width, height, options.halftoneSize);
  }

  const pngDataUrl = canvas.toDataURL('image/png');

  // Trace SVG via ImageTracer.js.
  const svgString = await new Promise<string>(resolve => {
    const opts: any = { pathprecision: 3, scale: 1 };
    ImageTracer.imageToSVG(pngDataUrl, (svg: string) => resolve(svg || ''), opts);
  });

  if (palette.length === 0) {
    // No quantization requested — derive a quick palette from the image.
    palette = [{ r: 0, g: 0, b: 0 }];
  }

  return { pngDataUrl, svgString, palette };
}
