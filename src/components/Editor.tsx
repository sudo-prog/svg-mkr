import React, { useEffect, useRef, useState } from 'react';
import { MousePointer2, Eraser, Wand2, Trash2 } from 'lucide-react';
import { useImageProcessor } from '../hooks/useImageProcessor';
import { floodFill, eraseAt } from '../core/imageToSvgCore';
import { ColorPalette } from './ColorPalette';
import { ExportBar } from './ExportBar';

export interface EditorProps {
  imageSrc: string | null;
  onBack: () => void;
}

export function Editor({ imageSrc, onBack }: EditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    result,
    loading,
    error,
    options,
    updateOptions,
    resetOptions,
    loadImage,
    reprocess,
    baseCanvas,
  } = useImageProcessor();

  const [tool, setTool] = useState<'select' | 'erase' | 'magicWand'>('select');
  const [brushSize, setBrushSize] = useState(24);
  const [wandTolerance, setWandTolerance] = useState(32);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const isDrawingRef = useRef(false);

  // Load image when source arrives
  useEffect(() => {
    if (imageSrc) loadImage(imageSrc);
  }, [imageSrc, loadImage]);

  // Paint processed result onto visible canvas
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

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!baseCanvas) return;
    const pos = getCanvasPos(e);
    const ctx = baseCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (tool === 'magicWand') {
      floodFill(ctx, baseCanvas.width, baseCanvas.height, pos.x, pos.y, wandTolerance);
      reprocess();
    } else if (tool === 'erase') {
      isDrawingRef.current = true;
      eraseAt(ctx, pos.x, pos.y, brushSize);
      reprocess();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || tool !== 'erase' || !baseCanvas) return;
    const pos = getCanvasPos(e);
    const ctx = baseCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    eraseAt(ctx, pos.x, pos.y, brushSize);
    reprocess();
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
  };

  const handleColorCountChange = (v: number) => {
    updateOptions({ colorCount: v });
    if (v <= 2) setSelectedColor(null);
  };

  const toggleColorDelete = (idx: number) => {
    const dc = options.deletedColors || [];
    const next = dc.includes(idx) ? dc.filter((d) => d !== idx) : [...dc, idx];
    updateOptions({ deletedColors: next });
  };

  const handlePaletteColorChange = (idx: number, color: { r: number; g: number; b: number }) => {
    const overrides = (options.paletteOverrides || result?.palette || []).slice();
    while (overrides.length <= idx) {
      overrides.push({ r: 0, g: 0, b: 0 });
    }
    overrides[idx] = color;
    updateOptions({ paletteOverrides: overrides });
  };

  const handleBack = () => {
    resetOptions();
    setSelectedColor(null);
    onBack();
  };

  if (!imageSrc) {
    onBack();
    return null;
  }

  return (
    <div className="min-h-screen bg-white text-black font-mono text-xs flex flex-col">
      {/* Header */}
      <header className="border-b border-black flex items-center justify-between px-4 h-12 shrink-0 sticky top-0 bg-white z-20">
        <button
          onClick={handleBack}
          className="text-[11px] uppercase tracking-widest hover:underline"
        >
          ← Back
        </button>
        <div className="text-[11px] uppercase tracking-widest opacity-50">
          {loading ? 'Processing…' : result?.palette?.length ? `${result.palette.length} colors` : '—'}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 pb-8">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Canvas */}
          <div className="border border-black bg-[#f4f4f4] flex items-center justify-center min-h-[320px] relative overflow-hidden">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
                <div className="text-[11px] uppercase tracking-widest animate-pulse">Processing…</div>
              </div>
            )}
            {error && (
              <div className="text-[11px] text-red-600 uppercase p-4 text-center">{error}</div>
            )}
            {!error && (
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className="max-w-full max-h-[min(70vh,640px)] object-contain touch-none"
                style={{
                  cursor: tool === 'erase' || tool === 'magicWand' ? 'crosshair' : 'default',
                }}
              />
            )}
          </div>

          {/* Controls panel */}
          <div className="border border-black bg-[#fafafa] p-4 space-y-5">
            {/* Tools */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setTool('select')}
                className={`p-2.5 border border-black flex items-center justify-center transition-colors ${
                  tool === 'select' ? 'bg-black text-white' : 'hover:bg-neutral-200'
                }`}
                title="Select"
              >
                <MousePointer2 size={15} />
              </button>
              <button
                onClick={() => setTool('erase')}
                className={`p-2.5 border border-black flex items-center justify-center transition-colors ${
                  tool === 'erase' ? 'bg-black text-white' : 'hover:bg-neutral-200'
                }`}
                title="Eraser"
              >
                <Eraser size={15} />
              </button>
              <button
                onClick={() => setTool('magicWand')}
                className={`p-2.5 border border-black flex items-center justify-center transition-colors ${
                  tool === 'magicWand' ? 'bg-black text-white' : 'hover:bg-neutral-200'
                }`}
                title="Magic wand"
              >
                <Wand2 size={15} />
              </button>

              {tool === 'erase' && (
                <div className="flex items-center gap-2 ml-2">
                  <input
                    type="range"
                    min={2}
                    max={80}
                    value={brushSize}
                    onChange={(e) => setBrushSize(+e.target.value)}
                    className="w-28 accent-black h-1"
                  />
                  <span className="w-10 text-right text-[10px] opacity-60">{brushSize}px</span>
                </div>
              )}
              {tool === 'magicWand' && (
                <div className="flex items-center gap-2 ml-2">
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={wandTolerance}
                    onChange={(e) => setWandTolerance(+e.target.value)}
                    className="w-28 accent-black h-1"
                  />
                  <span className="w-10 text-right text-[10px] opacity-60">{wandTolerance}</span>
                </div>
              )}
            </div>

            {/* Color count */}
            <div>
              <div className="flex justify-between text-[9px] uppercase opacity-60 mb-1.5">
                <span>Colors</span>
                <span>{options.colorCount}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={options.colorCount}
                onChange={(e) => handleColorCountChange(+e.target.value)}
                className="w-full accent-black h-1"
              />
              <div className="text-[9px] opacity-40 mt-1">1 = black · 2 = B&W · 3–10 = palette</div>
            </div>

            {/* Palette */}
            {result?.palette && result.palette.length > 0 && options.colorCount > 2 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[9px] uppercase opacity-60">Palette</div>
                  {selectedColor !== null && (
                    <button
                      onClick={() => toggleColorDelete(selectedColor)}
                      className="inline-flex items-center gap-1 text-[9px] uppercase opacity-70 hover:opacity-100"
                      title="Toggle delete selected color"
                    >
                      <Trash2 size={11} />
                      {options.deletedColors?.includes(selectedColor) ? 'Restore' : 'Remove'}
                    </button>
                  )}
                </div>
                <ColorPalette
                  palette={result.palette}
                  deletedColors={options.deletedColors || []}
                  onToggleDelete={toggleColorDelete}
                  onSelect={setSelectedColor}
                  onColorChange={handlePaletteColorChange}
                  selected={selectedColor}
                />
                <div className="text-[9px] opacity-40 mt-1.5">Click select · Double-click edit color</div>
              </div>
            )}

            {/* Filters grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <div className="flex justify-between text-[9px] uppercase opacity-60 mb-1">
                  <span>Hue</span>
                  <span>{options.hue}°</span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={options.hue}
                  onChange={(e) => updateOptions({ hue: +e.target.value })}
                  className="w-full accent-black h-1"
                />
              </div>
              <div>
                <div className="flex justify-between text-[9px] uppercase opacity-60 mb-1">
                  <span>Saturation</span>
                  <span>{options.saturation}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={options.saturation}
                  onChange={(e) => updateOptions({ saturation: +e.target.value })}
                  className="w-full accent-black h-1"
                />
              </div>

              <label className="flex items-center gap-2 text-[10px] uppercase cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.grayscale}
                  onChange={(e) => updateOptions({ grayscale: e.target.checked })}
                  className="accent-black"
                />
                B&W
              </label>
              <label className="flex items-center gap-2 text-[10px] uppercase cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.invert}
                  onChange={(e) => updateOptions({ invert: e.target.checked })}
                  className="accent-black"
                />
                Invert
              </label>

              <div>
                <div className="flex justify-between text-[9px] uppercase opacity-60 mb-1">
                  <span>Threshold</span>
                  <span>{options.threshold === null ? 'Off' : options.threshold}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={options.threshold ?? 0}
                  onChange={(e) => {
                    const v = +e.target.value;
                    updateOptions({ threshold: v === 0 ? null : v, halftone: false });
                  }}
                  className="w-full accent-black h-1"
                />
              </div>

              <label className="flex items-center gap-2 text-[10px] uppercase cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.halftone}
                  onChange={(e) => updateOptions({ halftone: e.target.checked, threshold: null })}
                  className="accent-black"
                />
                Halftone
              </label>
            </div>

            {options.halftone && (
              <div>
                <div className="flex justify-between text-[9px] uppercase opacity-60 mb-1">
                  <span>Halftone Size</span>
                  <span>{options.halftoneSize}px</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={20}
                  value={options.halftoneSize}
                  onChange={(e) => updateOptions({	ableofcontentsftoneSize: +e.target.value })}
                  className="w-full accent-black h-1"
                />
              </div>
            )}
          </div>

          {/* Export */}
          <div className="flex justify-between items-center flex-wrap gap-2 pt-1">
            <ExportBar
              pngDataUrl={result?.pngDataUrl || ''}
              svgString={result?.svgString || ''}
              showExport={!!result}
              onDownloadSvg={() => {
                if (!result?.svgString) return;
                const blob = new Blob([result.svgString], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'svg-mkr.svg';
                a.click();
                URL.revokeObjectURL(url);
              }}
              onDownloadPng={() => {
                if (!result?.pngDataUrl) return;
                const a = document.createElement('a');
                a.href = result.pngDataUrl;
                a.download = 'svg-mkr.png';
                a.click();
              }}
              onShare={async () => {
                if (!result?.pngDataUrl || !navigator.share) return;
                try {
                  const blob = await (await fetch(result.pngDataUrl)).blob();
                  const file = new File([blob], 'svg-mkr.png', { type: 'image/png' });
                  await navigator.share({ title: 'SVG_MKR', files: [file] });
                } catch {
                  // user cancelled or unsupported
                }
              }}
              onCopySvg={() => {
                if (result?.svgString) navigator.clipboard.writeText(result.svgString);
              }}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-black flex items-center justify-center px-4 h-10 bg-black text-white shrink-0">
        <span className="text-[9px] uppercase tracking-wider">SVG_MKR — Image to SVG</span>
      </footer>
    </div>
  );
}
