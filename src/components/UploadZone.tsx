import React from 'react';
import { Upload, Camera } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (source: string) => void;
  isLoading?: boolean;
}

/**
 * Centered upload control matching the dark monochrome aesthetic.
 * Handles file picker, camera capture, and is wired for drag-and-drop from parent.
 */
export function UploadZone({ onFileSelect, isLoading }: UploadZoneProps) {
  const handleFile = (file: File | undefined | null) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => onFileSelect(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const openPicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      handleFile(target.files?.[0]);
      target.value = '';
    };
    input.click();
  };

  const openCamera = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      handleFile(target.files?.[0]);
      target.value = '';
    };
    input.click();
  };

  return (
    <div className={`z-10 flex flex-col items-center gap-3 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Large white rectangular upload box */}
      <div
        onClick={openPicker}
        className="w-80 max-w-[90vw] h-44 bg-white border border-white flex items-center justify-center cursor-pointer hover:bg-neutral-100 transition-colors active:scale-[0.99]"
      >
        <div className="text-center px-4">
          <Upload className="mx-auto mb-2 text-charcoal" size={22} />
          <span className="block text-[11px] font-mono font-bold text-charcoal uppercase tracking-wider leading-relaxed">
            Click to Upload / Drop / Paste
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={openPicker}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white text-[12px] font-mono font-bold text-white hover:bg-white hover:text-charcoal transition-colors disabled:opacity-50"
        >
          <Upload size={15} />
          From Files
        </button>

        <button
          onClick={openCamera}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white text-[12px] font-mono font-bold text-white hover:bg-white hover:text-charcoal transition-colors disabled:opacity-50"
        >
          <Camera size={15} />
          Camera
        </button>
      </div>

      <p className="text-[10px] font-mono text-white/50 uppercase tracking-wider">
        or drop an image anywhere
      </p>
    </div>
  );
}
