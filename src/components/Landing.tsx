import { useState } from 'react';
import { RevolvingText } from './RevolvingText';
import { UploadZone } from './UploadZone';
import { Toast } from './Toast';

// Raw source of the core module — imported at build time via Vite's ?raw suffix.
// This is what the "Copy Code" button copies to the clipboard.
import coreSource from '../core/imageToSvgCore.ts?raw';
const CORE_MODULE_SOURCE = coreSource;

interface Props {
  onImage: (file: File) => void;
}

/**
 * Full-viewport landing page matching OKPalette's dark charcoal monochrome
 * aesthetic. Central 3D serif revolving text + white upload box.
 * Top-right: round "Copy Code" button that copies the pure core module.
 */
export function Landing({ onImage }: Props) {
  const [showToast, setShowToast] = useState(false);

  const copyCore = async () => {
    try {
      await navigator.clipboard.writeText(CORE_MODULE_SOURCE);
    } catch {
      // Clipboard may fail in some environments — still show toast
    }
    setShowToast(true);
  };

  // Full-page paste support (⌘V / Ctrl+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const item = e.clipboardData?.items?.[0];
    if (item && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) onImage(file);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-[#292f2f] text-white flex flex-col items-center justify-center overflow-hidden font-mono"
      onPaste={handlePaste}
    >
      {/* Top-right round Copy Code button */}
      <button
        onClick={copyCore}
        className="fixed top-4 right-4 z-50 w-12 h-12 rounded-full border border-white text-white hover:bg-white hover:text-[#292f2f] transition-colors flex items-center justify-center text-[8px] font-mono uppercase tracking-widest leading-tight overflow-hidden"
        title="Copy the pure core module source"
      >
        CODE
      </button>

      {/* Central revolving serif text */}
      <div className="flex-1 flex items-center justify-center">
        <RevolvingText text="SVG_MKR" />
      </div>

      {/* Upload zone */}
      <div className="mb-12">
        <UploadZone onFile={onImage} />
      </div>

      {/* Toast */}
      {showToast && <Toast message="Core code copied!" onDone={() => setShowToast(false)} />}
    </div>
  );
}
