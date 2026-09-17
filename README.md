# SVG_MKR v2

A beautiful, installable PWA that converts raster images into clean SVGs (and PNGs).  
Built with React 19 + Vite 6 + TypeScript 5.8 + Tailwind CSS v4 + ImageTracer.js.

## Visual Language

Inspired by the minimal monochrome aesthetic of [okpalette.color.pizza](https://okpalette.color.pizza):
- High-contrast black/white, monospace typography
- Sparse layout, no rounded corners (except buttons)
- Thin dashed/dotted borders, strict grid

## Features

- **Landing**: Full-viewport 3D revolving "SVG_MKR" text with inertia spin, ±20° tilt lock
- **Upload**: Click or drag-and-drop anywhere on the page
- **Color quantization**: 1–10 color slider (1 = pure black, 2 = B&W)
- **Interactive palette**: Click to delete a color (→ transparent), double-click for native color picker
- **Per-layer effects**: Halftone dot pattern, threshold binarization, outline
- **Background removal**: Magic wand (flood fill) + freehand eraser
- **Export**: SVG (via ImageTracer.js), PNG, Web Share API (Save to Camera Roll)
- **PWA**: Offline-capable, installable, service worker via vite-plugin-pwa
- **Copy Code**: One-click copies of the pure core module (`src/core/imageToSvgCore.ts`)

## Architecture

```
src/
├── core/
│   └── imageToSvgCore.ts   # Pure TS pipeline — no React, no UI
├── components/
│   ├── Landing.tsx
│   ├── RevolvingText.tsx
│   ├── UploadZone.tsx
│   ├── Editor.tsx
│   ├── ColorPalette.tsx
│   └── ExportBar.tsx
├── hooks/
│   └── useImageProcessor.ts
├── App.tsx                 # Landing ↔ Editor transition
├── main.tsx
├── index.css
└── vite-env.d.ts
```

### Core Module (`src/core/imageToSvgCore.ts`)

A pure TypeScript/JS pipeline with zero React/Tailwind dependencies:

```typescript
export interface ProcessOptions {
  colorCount: number;        // 1..10
  hue: number;               // -180..180
  saturation: number;        // 0..200
  grayscale: boolean;
  invert: boolean;
  threshold: number | null;  // 0..255
  halftone: boolean;
  halftoneSize: number;      // 2..20
  deletedColors: number[];
  paletteOverrides?: { r; g; b }[];
}

export interface ProcessResult {
  pngDataUrl: string;
  svgString: string;
  palette: { r; g; b }[];
}

export async function processImage(source: string, options: ProcessOptions): Promise<ProcessResult>
```

The pipeline:
1. **loadImage** — data-URL / blob-URL / remote URL → HTMLImageElement
2. **Constrain** — max dimension 1024px
3. **Filter** — hue-rotate, saturate, grayscale, invert (CSS canvas filter)
4. **Quantize** — frequency-based histogram, 16³ buckets, prune near-duplicates
5. **Map** — snap each pixel to nearest palette entry; deleted colors → transparent
6. **Threshold / Halftone** — binarize or dot-pattern dither
7. **Trace SVG** — ImageTracer.js on the processed PNG
8. **Return** — `{ pngDataUrl, svgString, palette }`

### Extracting Logic

The quantization (frequency histogram + colorMap), halftone (dot pattern),
threshold, floodFill (magic wand), and erase functions were extracted from the
original `ImageEditor.tsx` (3DDD Studio v1) and refactored into the pure core
module. All edits mutate an off-screen base canvas, then re-process.

## Development

```bash
npm install              # deps already installed
npm run dev              # start dev server on :3000
npm run build            # production build
npm run lint             # typecheck (tsc --noEmit)
npm run preview          # preview production build
```

## Deployment

Hosted on GitHub Pages at `https://sudo-prog.github.io/svg-mkr/`

The base path `/svg-mkr/` is configured in `vite.config.ts`.

```bash
npm run build
git add dist && git commit -m "chore: build"
git subtree push --prefix dist origin gh-pages
```

## License

MIT
