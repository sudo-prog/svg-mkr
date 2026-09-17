import React, { useEffect, useState } from 'react';
import { RevolvingText } from './RevolvingText';
import { UploadZone } from './UploadZone';

interface LandingProps {
  onImageSelected: (src: string) => void;
}

/**
 * Full-viewport landing page matching OKPalette's minimal monochrome aesthetic.
 * Central 3D revolving text + upload control.
 * Top-right: "Copy Code" button copies the core module source.
 */
export function Landing({ onImageSelected }: LandingProps) {
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleCopyCode = async () => {
    try {
      const res = await fetch('/src/core/imageToSvgCore.ts');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      setCopied(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => onImageSelected(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-white text-black flex flex-col items-center justify-center overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* OKPalette-style top chrome */}
      <div className="fixed top-0 left-0 right-0 h-12 border-b border-black flex items-center justify-between px-4 bg-white z-50">
        <div className="text-[13px] font-mono font-bold tracking-tighter">
          SVG_MKR
        </div>
        <button
          onClick={handleCopyCode}
          className="text-[11px] font-mono uppercase tracking-widest border border-black px-3 py-1 rounded-full hover:bg-black hover:text-white transition-colors"
          title="Copy the pure core module source"
        >
          {copied ? 'COPIED!' : 'Copy Code'}
        </button>
      </div>

      {/* Central revolving text */}
      <div className="flex-1 flex items-center justify-center">
        <RevolvingText text="SVG_MKR" />
      </div>

      {/* Upload zone (centered) */}
      <div className="mb-12">
        <UploadZone onFileSelect={onImageSelected} />
      </div>

      {/* Subtle footer */}
      <div className="fixed bottom-0 left-0 right-0 h-10 border-t border-black flex items-center justify-center px-4 text-[10px] font-mono uppercase tracking-wider opacity-40 bg-white z-50">
        Image to SVG Converter &middot; PWA
      </div>

      {/* Drag-over hint */}
      {dragOver && (
        <div className="fixed inset-0 bg-black/5 border-2 border-dashed border-black flex items-center justify-center text-[13px] font-mono z-50 pointer-events-none">
          DROP TO CONVERT
        </div>
      )}
    </div>
  );
}
