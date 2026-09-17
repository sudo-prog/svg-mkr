import React, { useEffect, useRef, useState } from 'react';
import { MousePointer2, Eraser, Wand2 } from 'lucide-react';
import ImageTracer from 'imagetracerjs';
import { floodFill, eraseAt } from '../core/imageToSvgCore';
import { useImageProcessor } from '../hooks/useImageProcessor';
import { ColorPalette } from './ColorPalette';
import { ExportBar } from './ExportBar';

export interface EditorProps {
  imageSrc: string | null;
  onBack: () => void;
}

const MAX_DIM = 1024;

export function Editor({ imageSrc, onBack }: EditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    result,
    loading,
    error,
    options,
    updateOptions,
    loadImage,
    reprocess,
    baseCanvas,
  } = useImageProcessor();

  // UI-local state
  const [tool, setTool] = useState<'select' | 'erase' | 'magicWand'>('select');
  const [brushSize, setBrushSize] = useState(20);
  const [wandTolerance, setWandTolerance] = useState(32);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);

  const isDrawingRef = useRef(false);

  // Load image on mount / when imageSrc changes.
  useEffect(() => {
    if (imageSrc) loadImage(imageSrc);
  }, [imageSrc, loadImage]);

  // Render the processed canvas whenever we have a result.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = result.pngDataUrl;
  }, [result]);

  // Listen for color overrides from the palette native picker.
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { idx, color } = e.detail;
      const overrides = (options.paletteOverrides || []).slice();
      overrides[idx] = color;
      updateOptions({ paletteOverrides: overrides });
    };
    window.addEventListener('palette-color-change', handler as any);
    return () => window.removeEventListener('palette-color-change', handler as any);
  }, [options.paletteOverrides, updateOptions]);

  // Re-process on options change (handled inside the hook via its deps),
  // but also re-render canvas from result.
  const reprocessAndRender = () => {
    reprocess();
  };

  // Canvas coordinate helper.
  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Canvas interaction operates on the *base* canvas (raw image + erasures).
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!baseCanvas) return;
    const pos = getCanvasPos(e);
    const ctx = baseCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (tool === 'magicWand') {
      floodFill(ctx, baseCanvas.width, baseCanvas.height, pos.x, pos.y, wandTolerance);
      reprocessAndRender();
    } else if (tool === 'erase') {
      isDrawingRef.current = true;
      eraseAt(ctx, pos.x, pos.y, brushSize);
      reprocessAndRender();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || tool !== 'erase' || !baseCanvas) return;
    const pos = getCanvasPos(e);
    const ctx = baseCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    eraseAt(ctx, pos.x, pos.y, brushSize);
    reprocessAndRender();
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
  };

  // Color-count slider: 1 → B&W black, 2 → B&W, 3..10 → palette sizes.
  const handleColorCountChange = (v: number) => {
    updateOptions({ colorCount: v });
    // colorCount === 1 means pure black → disable palette edits.
    if (v <= 2) setSelectedColor(null);
  };

  // Layer per-color effect toggle.
  const toggleColorDelete = (idx: number) => {
    const dc = options.deletedColors || [];
    const next = dc.includes(idx) ? dc.filter(d => d !== idx) : [...dc, idx];
    updateOptions({ deletedColors: next });
  };

  const runSvgTrace = () => {
    if (!canvasRef.current) return;
    const bc = baseCanvas;
    if (bc) {
      ImageTracer.imageToSVG(
        bc.toDataURL('image/png'),
        (svg: string) => {
          if (svg) {
            const blob = new Blob([svg], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'svg-mkr-output.svg';
            a.click();
            URL.revokeObjectURL(url);
          }
        },
        { pathprecision: 3, scale: 1 },
      );
    }
  };

  if (!imageSrc) {
    onBack();
    return null;
  }

  return (
    <div className="min-h-screen bg-white text-black font-mono text-xs flex flex-col">
      {/* Header */}
      <header className="border-b border-black flex items-center justify-between px-4 h-12 shrink-0">
        <button
          onClick={() => {
            // Reset state and go back.
            updateOptions({
              colorCount: 4,
              hue: 0,
              saturation: 100,
              grayscale: false,
              invert: false,
              threshold: null,
              halftone: false,
              halftoneSize: 4,
              deletedColors: [],
              paletteOverrides: undefined,
            });
            onBack();
          }}
          className="text-[11px] uppercase tracking-widest hover:underline"
        >
          ← Back
        </button>
        <div className="text-[11px] uppercase tracking-widest opacity-50">
          {result?.palette?.length ? `${result.palette.length} colors` : '—'}
        </div>
      </header>

      {/* Main canvas + controls */}
      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">
          {/* Live canvas */}
          <div className="border border-black bg-[#f5f5f5] flex items-center justify-center mb-4 min-h-[400px]">
            {loading && (
              <div className="text-[11px] uppercase tracking-widest animate-pulse">
                Processing…
              </div>
            )}
            {error && (
              <div className="text-[11px] text-red-600 uppercase">{error}</div>
            )}
            {!loading && !error && (
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                style={{
                  cursor:
                    tool === 'erase' || tool === 'magicWand' ? 'crosshair' : 'default',
                  maxWidth: '100%',
                  maxHeight: 'calc(100vh - 200px)',
                  objectFit: 'contain',
                }}
              />
            )}
          </div>

          {/* Controls */}
          <div className="space-y-4 border border-black bg-[#fafafa] p-4">
            {/* Tools row */}
            <div className="flex gap-2">
              <button
                onClick={() => setTool('select')}
                className={`p-2 border border-black flex items-center justify-center ${
                  tool === 'select' ? 'bg-black text-white' : 'hover:bg-[#e0e0e0]'
                }`}
                title="Select"
              >
                <MousePointer2 size={14} />
              </button>
              <button
                onClick={() => setTool('erase')}
                className={`p-2 border border-black flex items-center justify-center ${
                  tool === 'erase' ? 'bg-black text-white' : 'hover:bg-[#e0e0e0]'
                }`}
                title="Eraser"
              >
                <Eraser size={14} />
              </button>
              <button
                onClick={() => setTool('magicWand')}
                className={`p-2 border border-black flex items-center justify-center ${
                  tool === 'magicWand' ? 'bg-black text-white' : 'hover:bg-[#e0e0e0]'
                }`}
                title="Magic wand"
              >
                <Wand2 size={14} />
              </button>
              {tool === 'erase' && (
                <>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={brushSize}
                    onChange={e => setBrushSize(+e.target.value)}
                    className="w-24 accent-black h-1 ml-auto"
                  />
                  <span className="w-10 text-right text-[10px] opacity-60">{brushSize}px</span>
                </>
              )}
              {tool === 'magicWand' && (
                <>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={wandTolerance}
                    onChange={e => setWandTolerance(+e.target.value)}
                    className="w-24 accent-black h-1 ml-auto"
                  />
                  <span className="w-10 text-right text-[10px] opacity-60">{wandTolerance}</span>
                </>
              )}
            </div>

            {/* Color quantization 1-10 */}
            <div>
              <div className="flex justify-between text-[9px] uppercase opacity-60 mb-1">
                <span>COLORS</span>
                <span>{options.colorCount}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={options.colorCount}
                onChange={e => handleColorCountChange(+e.target.value)}
                className="w-full accent-black h-1"
              />
              <div className="text-[9px] opacity-40 mt-1">
                1 = black · 2 = B&W · 3–10 = palette
              </div>
            </div>

            {/* Palette boxes */}
            {result?.palette && result.palette.length > 0 && options.colorCount > 2 && (
              <div>
                <div className="text-[9px] uppercase opacity-60 mb-2">PALETTE</div>
                <ColorPalette
                  palette={result.palette}
                  deletedColors={options.deletedColors || []}
                  onToggleDelete={toggleColorDelete}
                  onSelect={idx => setSelectedColor(idx)}
                  selected={selectedColor}
                />
              </div>
            )}

            {/* Filters */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-[9px] uppercase opacity-60 mb-1">
                  <span>HUE</span>
                  <span>{options.hue}°</span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={options.hue}
                  onChange={e => updateOptions({ hue: +e.target.value })}
                  className="w-full accent-black h-1"
                />
              </div>
              <div>
                <div className="flex justify-between text-[9px] uppercase opacity-60 mb-1">
                  <span>SAT</span>
                  <span>{options.saturation}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={options.saturation}
                  onChange={e => updateOptions({ saturation: +e.target.value })}
                  className="w-full accent-black h-1"
                />
              </div>
              <label className="flex items-center gap-2 text-[10px]">
                <input
                  type="checkbox"
                  checked={options.grayscale}
                  onChange={e => updateOptions({ grayscale: e.target.checked })}
                />
                B&W
              </label>
              <label className="flex items-center gap-2 text-[10px]">
                <input
                  type="checkbox"
                  checked={options.invert}
                  onChange={e => updateOptions({ invert: e.target.checked })}
                />
                INVERT
              </label>
              <div>
                <div className="flex justify-between text-[9px] uppercase opacity-60 mb-1">
                  <span>THRESHOLD</span>
                  <span>{options.threshold === null ? 'OFF' : options.threshold}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={options.threshold ?? 0}
                  onChange={e => {
                    const v = +e.target.value;
                    updateOptions({ threshold: v === 0 ? null : v, halftone: false });
                  }}
                  className="w-full accent-black h-1"
                />
              </div>
              <label className="flex items-center gap-2 text-[10px]">
                <input
                  type="checkbox"
                  checked={options.halftone}
                  onChange={e => updateOptions({ halftone: e.target.checked, threshold: null })}
                />
                HALFTONE
              </label>
            </div>
            {options.halftone && (
              <div>
                <div className="flex justify-between text-[9px] uppercase opacity-60 mb-1">
                  <span>SIZE</span>
                  <span>{options.halftoneSize}px</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={20}
                  value={options.halftoneSize}
                  onChange={e => updateOptions({ halftoneSize: +e.target.value })}
                  className="w-full accent-black h-1"
                />
              </div>
            )}
          </div>

          {/* Export */}
          <div className="mt-4 flex justify-between items-center">
            <ExportBar
              pngDataUrl={result?.pngDataUrl || ''}
              svgString={result?.svgString || ''}
              showExport={!!result}
              onDownloadSvg={runSvgTrace}
              onDownloadPng={() => {
                if (!canvasRef.current) return;
                const a = document.createElement('a');
                a.href = canvasRef.current.toDataURL('image/png');
                a.download = 'svg-mkr-output.png';
                a.click();
              }}
              onShare={async () => {
                if (!canvasRef.current || !navigator.share) return;
                try {
                  const blob = await (await fetch(canvasRef.current.toDataURL('image/png'))).blob();
                  const file = new File([blob], 'svg-mkr-output.png', { type: 'image/png' });
                  await navigator.share({ title: 'SVG_MKR output', files: [file] });
                } catch (e) {
                  // fallback to download
                }
              }}
              onCopySvg={() => {
                if (result?.svgString) navigator.clipboard.writeText(result.svgString);
              }}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-black flex items-center justify-center px-4 h-10 bg-black text-white">
        <span className="text-[9px] uppercase tracking-wider">
          SVG_MKR v2 — Image to SVG Converter
        </span>
      </footer>
    </div>
  );
}
