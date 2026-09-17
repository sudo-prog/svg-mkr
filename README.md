# SVG_MKR

A beautiful, installable PWA that converts images into clean SVGs (and PNGs).
Built with React 19 + Vite 6 + TypeScript 5.8 + Tailwind CSS v4 + ImageTracer.js.

**Visual language:** sparse black/white monospace aesthetic, inspired by
[okpalette.color.pizza](https://okpalette.color.pizza).

## Features

- **Landing**: Full-viewport 3D revolving "SVG_MKR" text (auto-spin + swipe + ±20° tilt + half-tone occlusion)
- **Copy Code**: One-click copies of the pure core module (`src/core/imageToSvgCore.ts`)
- **Upload**: Click or full-page drag-and-drop · Files / Camera pickers · ⌘V paste
- **Color quantization**: 1–10 color slider (1 = pure black, 2 = B&W, 3+ = palette)
- **Interactive palette**: Click to select, double-click to recolor, per-layer halftone / distressed / outline / delete → transparent
- **Background removal**: Delete colors to make them transparent (Esc to toggle)
- **Export**: SVG (via ImageTracer.js), PNG, Web Share API (Save to Camera Roll on mobile)
- **PWA**: Offline-capable, installable, service worker via vite-plugin-pwa

## Architecture

```
src/
├── core/
│   └── imageToSvgCore.ts   # Pure TS pipeline — no React, no UI
├── components/
│   ├── Landing.tsx         # 3D revolving text + upload + copy code
│   ├── RevolvingText.tsx   # CSS 3D ring text w/ inertia + tilt clamp
│   ├── UploadZone.tsx      # File/camera picker + drag-and-drop
│   ├── Editor.tsx          # Canvas + color slider + palette + export
│   ├── ColorPalette.tsx    # Color boxes + LAYER effect buttons
│   └── Toast.tsx           # Auto-dismiss feedback
├── App.tsx                 # Landing ↔ Editor transition (File state)
├── main.tsx
├── index.css
└── vite-env.d.ts
```

### Core Module (`src/core/imageToSvgCore.ts`)

A pure TypeScript pipeline with zero React/Tailwind dependencies:

```typescript
export async function processImage(
  source: string | HTMLImageElement | File | Blob,
  options: ProcessOptions = {},
): Promise<ProcessResult>
```

The pipeline: load → constrain (max 1024px) → CSS filter (hue-rotate / saturate / grayscale / invert) → frequency-based quantization (16³ histogram) → pixel map (deleted colors → transparent, overrides applied) → halftone/threshold → output PNG → ImageTracer SVG trace.

## Development

```bash
npm install
npm run dev        # dev server on :3000
npm run build      # production build
npm run lint       # typecheck (tsc --noEmit)
npm run preview    # preview production build
```

## Deployment

Hosted on GitHub Pages at `https://sudo-prog.github.io/svg-mkr/`.

The base path `/svg-mkr/` is configured in `vite.config.ts`.

```bash
npm run build
git add dist && git commit -m "chore: build"
git subtree push --prefix dist origin gh-pages
```

## License

MIT
