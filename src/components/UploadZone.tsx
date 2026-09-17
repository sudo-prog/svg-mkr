import React, { useCallback } from 'react';
import { Upload, Camera } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (source: string) => void;
  onDrop?: (e: React.DragEvent) => void;
  isLoading?: boolean;
}

const ACCEPT_ATTR = 'image/*;capture=camera';

/**
 * Centered upload control matching OKPalette's aesthetic:
 * - Large white rectangular upload area
 * - Black monospace text (#0a0f0f)
 * - Handles file picker (Files / Camera) and full-page drag-and-drop.
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-charcoal/80 backdrop-blur pointer-events-none">
      <div
        className={`relative flex flex-col items-center gap-3 ${
          isLoading ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        {/* Large white rectangular upload box with black monospace text */}
        <div
          onClick={openPicker}
          className="w-80 h-48 bg-white border border-white rounded flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
          style={{ borderWidth: 1 }}
        >
          <div className="text-center">
            <Upload className="mx-auto mb-2 text-charcoal" size={20} />
            <span className="block text-[11px] font-mono font-bold text-charcoal uppercase tracking-wider">
              Click to Upload Image / Drop Here
            </span>
            <span className="block text-[10px] font-mono text-charcoal opacity-60 mt-1">
              or press ⌘V
            </span>
          </div>
        </div>

        <button
          onClick={openCamera}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-white text-[13px] font-mono font-bold text-white hover:bg-white hover:text-charcoal transition-colors disabled:opacity-50"
        >
          <Camera size={16} />
          From Camera Roll
        </button>
        <label
          htmlFor="dropzone-file"
          className="mt-2 text-[10px] font-mono text-white uppercase tracking-wider cursor-pointer"
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
