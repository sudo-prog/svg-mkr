import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, Share2 } from 'lucide-react';
import { ColorPalette, PaletteColor } from './ColorPalette';
import { processImage } from '../core/imageToSvgCore';

interface Props {
  file: File;
  onBack: () => void;
}

/**
 * Editor: live canvas + 1–10 color slider + palette with per-layer effects.
 * Esc deletes the selected layer (toggles transparency).
 */
export function Editor({ file, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [colorCount, setColorCount] = useState(4);
  const [palette, setPalette] = useState<PaletteColor[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [deletedIndices, setDeletedIndices] = useState<number[]>([]);
  const [activeEffects, setActiveEffects] = useState<
    Record<number, 'halftone' | 'distressed' | 'outline' | null>
  >({});
  const [pngUrl, setPngUrl] = useState('');
  const [svgString, setSvgString] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Process image whenever the file, color count, or deleted colors change.
  useEffect(() => {
    let cancelled = false;
    setIsProcessing(true);

    processImage(file, {
      colorCount,
      deletedColors: deletedIndices,
    }).then((result) => {
      if (cancelled) return;
      setPalette(result.palette);
      setPngUrl(result.pngDataUrl);
      setSvgString(result.svgString);

      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = result.pngDataUrl;
      setIsProcessing(false);
    });

    return () => {
      cancelled = true;
    };
  }, [file, colorCount, deletedIndices]);

  // Esc → delete (toggle transparency of) selected layer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIndex !== null) {
        setDeletedIndices((prev) =>
          prev.includes(selectedIndex)
            ? prev.filter((i) => i !== selectedIndex)
            : [...prev, selectedIndex],
        );
        setSelectedIndex(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIndex]);

  const getLabel = (n: number) => {
    if (n === 1) return '1 — Pure Black';
    if (n === 2) return '2 — Black & White';
    return `${n} — B&W + ${n - 2} color${n - 2 > 1 ? 's' : ''}`;
  };

  const download = (type: 'png' | 'svg') => {
    if (type === 'png' && pngUrl) {
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = 'svg-mkr.png';
      a.click();
    }
    if (type === 'svg' && svgString) {
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'svg-mkr.svg';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const share = async () => {
    if (navigator.share && pngUrl) {
      const blob = await (await fetch(pngUrl)).blob();
      const fileToShare = new File([blob], 'svg-mkr.png', { type: 'image/png' });
      await navigator.share({ files: [fileToShare], title: 'SVG_MKR' });
    }
  };

  return (
    <div className="min-h-screen bg-[#292f2f] text-white font-mono">
      {/* Header */}
      <header className="border-b border-white/20 flex items-center justify-between px-4 h-12 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1 text-[11px] uppercase tracking-widest hover:underline"
        >
          <ArrowLeft size={14} />
          BACK
        </button>
        <span className="text-[11px] uppercase tracking-widest opacity-60">SVG_MKR</span>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">
          {/* Canvas area */}
          <div className="border border-white/20 bg-[#1a1a1a] flex items-center justify-center mb-4 min-h-[400px]">
            {isProcessing ? (
              <span className="text-[11px] uppercase tracking-widest">
                PROCESSING…
              </span>
            ) : (
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-[calc(100vh-200px)] object-contain"
              />
            )}
          </div>

          {/* Controls */}
          <div className="border border-white/20 p-4 space-y-4">
            {/* Colors slider */}
            <div>
              <div className="flex justify-between text-[9px] uppercase tracking-widest opacity-60 mb-1">
                <span>COLORS</span>
                <span className="font-mono">{getLabel(colorCount)}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={colorCount}
                onChange={(e) => setColorCount(Number(e.target.value))}
                className="w-full accent-black h-1"
              />
              <div className="text-[9px] opacity-40 mt-1 font-mono">
                1 = black · 2 = B&amp;W · 3–10 = palette
              </div>
            </div>

            {/* Palette + layer effects */}
            {palette.length > 0 && colorCount > 2 && (
              <ColorPalette
                colors={palette}
                selectedIndex={selectedIndex}
                deletedIndices={deletedIndices}
                onSelect={setSelectedIndex}
                onRecolor={(index, hex) => {
                  setPalette((prev) => {
                    const next = [...prev];
                    next[index] = { ...next[index], hex };
                    return next;
                  });
                }}
                onDelete={(index) => {
                  setDeletedIndices((prev) =>
                    prev.includes(index)
                      ? prev.filter((i) => i !== index)
                      : [...prev, index],
                  );
                  setSelectedIndex(null);
                }}
                onEffect={(index, effect) => {
                  setActiveEffects((prev) => ({ ...prev, [index]: effect }));
                }}
                activeEffect={activeEffects}
              />
            )}

            {/* Export */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => download('svg')}
                className="flex-1 py-3 border-2 border-black text-xs font-bold tracking-widest hover:bg-black hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                EXPORT SVG
                <Download size={14} />
              </button>
              <button
                onClick={() => download('png')}
                className="flex-1 py-3 border border-black text-xs font-bold tracking-widest hover:bg-black hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                EXPORT PNG
                <Download size={14} />
              </button>
              {'share' in navigator && (
                <button
                  onClick={share}
                  className="flex-1 py-3 border border-black text-xs font-bold tracking-widest hover:bg-black hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  SAVE / SHARE
                  <Share2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
