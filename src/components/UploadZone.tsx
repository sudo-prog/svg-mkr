import React, { useCallback } from 'react';
import { Upload, Camera } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (source: string) => void;
  onDrop?: (e: React.DragEvent) => void;
  isLoading?: boolean;
}

const ACCEPT_ATTR = 'image/*;capture=camera';

/**
 * Centered, full-viewport upload control matching OKPalette's minimal aesthetic.
 * Handles file picker (Files / Camera) and full-page drag-and-drop.
 */
export function UploadZone({ onFileSelect, isLoading }: UploadZoneProps) {
  const fileInputRef = useCallback((el: HTMLInputElement | null) => {
    // no-op; ref attached below
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => onFileSelect(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const openPicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = handleFileChange as any;
    input.click();
  };

  const openCamera = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*;capture=environment';
    input.capture = 'environment';
    input.onchange = handleFileChange as any;
    input.click();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/80 backdrop-blur pointer-events-none">
      <div
        className={`relative flex flex-col items-center gap-3 ${
          isLoading ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <button
          onClick={openPicker}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-black text-[13px] font-mono font-bold tracking-tight hover:bg-black hover:text-white transition-colors disabled:opacity-50"
        >
          <Upload size={16} />
          From Files
        </button>
        <button
          onClick={openCamera}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-black text-[13px] font-mono font-bold tracking-tight hover:bg-black hover:text-white transition-colors disabled:opacity-50"
        >
          <Camera size={16} />
          From Camera Roll
        </button>
        <label
          htmlFor="dropzone-file"
          className="mt-2 text-[10px] uppercase tracking-wider opacity-40 cursor-pointer"
        >
          or drop an image anywhere
        </label>
        <input
          id="dropzone-file"
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
