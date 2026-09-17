# SVG_MKR — Image to SVG Converter

A vanilla HTML/CSS/JS web app that converts raster images to clean SVGs, inspired by [okpalette.color.pizza](https://okpalette.color.pizza/).

## Features

- **Color extraction** (1–10 colors) via [ImageTracer.js](https://github.com/jankovicsandras/imagetracerjs)
- **Hue / Saturation** sliders with real-time re-tracing
- **Auto-trace** toggle — re-processes on every slider change
- **Per-layer effects** — halftone, distress, and outline on individual color layers
- **Magic wand** + **eraser** background removal
- **Loupe** (magnifying glass) over the source image
- **SVG / PNG export**, copy palette hex, native share
- **Keyboard shortcuts** — `⌘/Ctrl+I` debug, `Esc` delete layer, `⌘/Ctrl+E` export, `⌘/Ctrl+S` stats
- No build step — deploy static files directly

## Development

```bash
# Serve locally
npx serve .
# or
python3 -m http.server 8080
```

## Deployment

Static files deployed to `gh-pages` branch. GitHub Pages serves from `gh-pages/`.

## License

MIT
