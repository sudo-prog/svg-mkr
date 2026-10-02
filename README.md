# SVG_MKR — Image to SVG Converter

A fast, browser-based tool that turns raster images into clean multi-color SVGs.

Inspired by [okpalette.color.pizza](https://okpalette.color.pizza/).

## Features

- **Color quantization** (1–10 colors) via frequency histogram + ImageTracer.js
- **Live controls** — Hue, Saturation, B&W, Invert, Threshold, Halftone
- **Background removal** — Magic wand + freehand eraser
- **Per-color editing** — Click to select / delete layers, double-click to recolor
- **Export** — SVG, PNG, copy SVG to clipboard, native share
- **PWA** ready (installable, offline-capable)
- **Paste / drag-and-drop** image support

## Tech Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS v4
- ImageTracer.js
- Lucide icons
- vite-plugin-pwa

## Development

```bash
npm install
npm run dev
```

App runs at `http://localhost:3000` (base path `/svg-mkr/` for production).

```bash
npm run build   # outputs to dist/
npm run preview
npm run lint    # tsc --noEmit
```

## Project Structure

```
src/
├── App.tsx                  # Landing ↔ Editor
├── main.tsx
├── components/
│   ├── Landing.tsx
│   ├── Editor.tsx
│   ├── ColorPalette.tsx
│   ├── ExportBar.tsx
│   ├── UploadZone.tsx
│   ├── RevolvingText.tsx
│   └── Toast.tsx
├── core/
│   └── imageToSvgCore.ts   # Pure processing pipeline
├── hooks/
│   └── useImageProcessor.ts
└── index.css
```

## Deployment

Static build is configured with `base: '/svg-mkr/'` for GitHub Pages.

```bash
npm run build
# deploy the contents of dist/ to the gh-pages branch (or any static host)
```

## License

MIT
