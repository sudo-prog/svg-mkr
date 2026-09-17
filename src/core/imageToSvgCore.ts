/**
 * SVG_MKR Core – Pure image → SVG / PNG pipeline
 * Zero UI / React dependencies. Safe to copy into any project.
 */

import ImageTracer from 'imagetracerjs';

// ── Interfaces ────────────────────────────────────────────────────────────

/**
 * Options controlling the full processing pipeline.
 * - colorCount: 1 = pure black, 2 = B&W, 3..10 = increasing palette size.
 * - hue / saturation: applied as CSS filter hue-rotate / saturate.
 * - grayscale: force luminance grayscale.
 * - invert: invert colors after filters.
 * - threshold: 0..255; null = off. Binarizes to black/white.
 * - halftone: dot-pattern dithering.
 * - halftoneSize: dot cell size in px.
 * - deletedColors: indices into the quantized palette to make transparent.
 * - paletteOverrides: explicit hex overrides keyed by palette index.
 */
export interface ProcessOptions {
  colorCount?: number; // 1–10
  hue?: number;
  saturation?: number;
  grayscale?: boolean;
  invert?: boolean;
  threshold?: number | null;
  halftone?: boolean;
  halftoneSize?: number;
  deletedColors?: number[];
  paletteOverrides?: Record<number, string>;
}

export interface ProcessResult {
  pngDataUrl: string;
  svgString: string;
  palette: { r: number; g: number; b: number; hex: string }[];
}

// ── Core pipeline ──────────────────────────────────────────────────────────

/**
 * Full pipeline: load → constrain size → filter → quantize →
 * map pixels to palette (deleted → transparent, overrides applied) →
 * (halftone | threshold) → output PNG → SVG trace.
 *
 * `source` may be a data-URL, blob-URL, <img> element, File, or Blob.
 */
export async function processImage(
  source: string | HTMLImageElement | File | Blob,
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const {
    colorCount = 4,
    hue = 0,
    saturation = 100,
    grayscale = false,
    invert = false,
    threshold = null,
    halftone = false,
    halftoneSize = 4,
    deletedColors = [],
    paletteOverrides = {},
  } = options;

  const img = await loadImage(source);
  const { canvas: base } = createCanvas(img, 1024);

  // ── Apply CSS filters on a separate canvas ──────────────────────────────
  const filtered = document.createElement('canvas');
  filtered.width = base.width;
  filtered.height = base.height;
  const fCtx = filtered.getContext('2d', { willReadFrequently: true })!;
  let filter = `hue-rotate(${hue}deg) saturate(${saturation}%)`;
  if (grayscale) filter += ' grayscale(100%)';
  if (invert) filter += ' invert(100%)';
  fCtx.filter = filter;
  fCtx.drawImage(base, 0, 0);

  // ── Quantize ────────────────────────────────────────────────────────────
  const { imageData, palette } = quantize(filtered, colorCount);

  // ── Apply overrides + deletions ─────────────────────────────────────────
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;

    let best = 0;
    let minDist = Infinity;
    for (let j = 0; j < palette.length; j++) {
      const p = palette[j];
      const d = (data[i] - p.r) ** 2 + (data[i + 1] - p.g) ** 2 + (data[i + 2] - p.b) ** 2;
      if (d < minDist) {
        minDist = d;
        best = j;
      }
    }

    if (deletedColors.includes(best)) {
      data[i + 3] = 0; // transparent
    } else if (paletteOverrides[best]) {
      const c = hexToRgb(paletteOverrides[best]);
      data[i] = c.r;
      data[i + 1] = c.g;
      data[i + 2] = c.b;
    } else {
      data[i] = palette[best].r;
      data[i + 1] = palette[best].g;
      data[i + 2] = palette[best].b;
    }
  }

  // ── Half-tone / threshold ───────────────────────────────────────────────
  if (halftone || threshold !== null) {
    applyHalftoneOrThreshold(imageData, halftone, halftoneSize, threshold);
  }

  // ── Output PNG ──────────────────────────────────────────────────────────
  const out = document.createElement('canvas');
  out.width = base.width;
  out.height = base.height;
  const outCtx = out.getContext('2d')!;
  outCtx.putImageData(imageData, 0, 0);
  const pngDataUrl = out.toDataURL('image/png');

  // ── Trace to SVG ────────────────────────────────────────────────────────
  const svgString = await new Promise<string>((resolve) => {
    ImageTracer.imageToSVG(
      pngDataUrl,
      (svg: string) => resolve(svg),
      {
        numberofcolors: Math.max(2, colorCount),
        pathomit: 8,
        ltres: 1,
        qtres: 1,
        scale: 1,
        viewbox: true,
      },
    );
  });

  return {
    pngDataUrl,
    svgString,
    palette: palette.map((p) => ({
      ...p,
      hex: rgbToHex(p.r, p.g, p.b),
    })),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Load a data-URL / blob-URL / object-URL / File / Blob / <img> → HTMLImageElement. */
function loadImage(
  src: string | HTMLImageElement | File | Blob,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    if (typeof src === 'string') {
      img.src = src;
    } else if (src instanceof HTMLImageElement) {
      resolve(src);
    } else {
      img.src = URL.createObjectURL(src);
    }
  });
}

/** Create an off-screen canvas sized to fit the image within `maxSize`. */
function createCanvas(img: HTMLImageElement, maxSize: number) {
  let w = img.width;
  let h = img.height;
  if (w > maxSize || h > maxSize) {
    const r = Math.min(maxSize / w, maxSize / h);
    w = Math.round(w * r);
    h = Math.round(h * r);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, ctx };
}

/**
 * Frequency-based quantizer.
 * Down-samples to a color histogram with 16³ buckets, sorts by frequency,
 * prunes near-duplicates (dist < 28), and pads to the requested count.
 * Special case: colorCount === 1 → pure black.
 */
function quantize(canvas: HTMLCanvasElement, count: number) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const colorMap = new Map<
    string,
    { r: number; g: number; b: number; count: number }
  >();

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // skip transparent
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${Math.floor(r / 16)},${Math.floor(g / 16)},${Math.floor(b / 16)}`;
    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { r, g, b, count: 1 });
    }
  }

  const sorted = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
  const palette: { r: number; g: number; b: number }[] = [];

  for (const c of sorted) {
    if (palette.length >= count) break;
    let tooClose = false;
    for (const p of palette) {
      const dist = Math.sqrt(
        (c.r - p.r) ** 2 + (c.g - p.g) ** 2 + (c.b - p.b) ** 2,
      );
      if (dist < 28) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) palette.push({ r: c.r, g: c.g, b: c.b });
  }

  // Force at least the requested count.
  while (palette.length < count && sorted.length > palette.length) {
    const next = sorted[palette.length];
    if (next) palette.push({ r: next.r, g: next.g, b: next.b });
    else break;
  }

  // Special case for 1 color → pure black.
  if (count === 1) {
    palette.length = 0;
    palette.push({ r: 0, g: 0, b: 0 });
  }

  return { imageData, palette };
}

/**
 * Apply either a halftone dot-pattern or a simple threshold binarization.
 * Mutates `imageData.data` in place.
 */
function applyHalftoneOrThreshold(
  imageData: ImageData,
  halftone: boolean,
  size: number,
  threshold: number | null,
) {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  if (halftone) {
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
              const dist = Math.sqrt(
                (dx - size / 2) ** 2 + (dy - size / 2) ** 2,
              );
              const color = dist < radius ? 0 : 255;
              data[idx] = data[idx + 1] = data[idx + 2] = color;
            }
          }
        }
      }
    }
  } else if (threshold !== null) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const v = avg >= threshold ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }
}

/** Convert '#rrggbb' or '#rgb' → { r, g, b }. */
function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(full, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

/** Convert { r, g, b } → '#RRGGBB'. */
function rgbToHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b]
      .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'))
      .join('')
  );
}
