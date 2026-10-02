import React, { useState } from 'react';
import { RevolvingText } from './RevolvingText';
import { UploadZone } from './UploadZone';
import coreSource from '../core/imageToSvgCore.ts?raw';

interface LandingProps {
  onImageSelected: (src: string) => void;
}

/**
 * Full-viewport landing page — dark charcoal monochrome aesthetic.
 * Central 3D revolving text + upload box.
 */
export function Landing({ onImageSelected }: LandingProps) {
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(coreSource);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
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

  // Paste support
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => onImageSelected(ev.target?.result as string);
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onImageSelected]);

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
      {/* Copy core source */}
      <button
        onClick={handleCopyCode}
        className="fixed top-4 right-4 z-50 w-12 h-12 rounded-full border border-white/80 text-white hover:bg-white hover:text-charcoal transition-colors flex items-center justify-center text-[8px] font-mono uppercase tracking-widest leading-tight"
        title="Copy the pure core module source"
      >
        {copied ? '✓' : 'CODE'}
      </button>

      {/* Revolving text */}
      <div className="flex-1 flex items-center justify-center w-full">
        <RevolvingText text="SVG_MKR" />
      </div>

      {/* Upload */}
      <div className="mb-14 px-4">
        <UploadZone onFileSelect={onImageSelected} />
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 h-10 border-t border-white/30 flex items-center justify-center px-4 text-[10px] font-mono uppercase tracking-wider opacity-50 bg-charcoal z-40">
        Image to SVG Converter · PWA
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 bg-white/10 border-2 border-dashed border-white flex items-center justify-center text-[13px] font-mono text-white z-50 pointer-events-none">
          DROP TO CONVERT
        </div>
      )}
    </div>
  );
}
