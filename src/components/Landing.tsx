import React, { useEffect, useState } from 'react';
import { RevolvingText } from './RevolvingText';
import { UploadZone } from './UploadZone';
import coreSource from '../core/imageToSvgCore.ts?raw';

interface LandingProps {
  onImageSelected: (src: string) => void;
}

/**
 * Full-viewport landing page matching OKPalette's dark charcoal monochrome aesthetic.
 * Central 3D serif revolving text + white upload box.
 * Top-right: round "Copy Code" button copies the core module source.
 */
export function Landing({ onImageSelected }: LandingProps) {
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(coreSource);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
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
      className="fixed inset-0 bg-charcoal text-white flex flex-col items-center justify-center overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Top-right round Copy Code button — visible against dark bg with white border */}
      <button
        onClick={handleCopyCode}
        className="fixed top-4 right-4 z-50 w-12 h-12 rounded-full border border-white text-white hover:bg-white hover:text-charcoal transition-colors flex items-center justify-center text-[8px] font-mono uppercase tracking-widest leading-tight overflow-hidden"
        title="Copy the pure core module source"
      >
        {copied ? '✓' : 'CODE'}
      </button>

      {/* Central revolving serif text */}
      <div className="flex-1 flex items-center justify-center">
        <RevolvingText text="SVG_MKR" />
      </div>

      {/* Upload zone — large white rectangular box with black monospace */}
      <div className="mb-12">
        <UploadZone onFileSelect={onImageSelected} />
      </div>

      {/* Subtle footer */}
      <div className="fixed bottom-0 left-0 right-0 h-10 border-t border-white flex items-center justify-center px-4 text-[10px] font-mono uppercase tracking-wider opacity-40 bg-charcoal z-50">
        Image to SVG Converter &middot; PWA
      </div>

      {/* Drag-over hint */}
      {dragOver && (
        <div className="fixed inset-0 bg-white/10 border-2 border-dashed border-white flex items-center justify-center text-[13px] font-mono text-white z-50 pointer-events-none">
          DROP TO CONVERT
        </div>
      )}
    </div>
  );
}
