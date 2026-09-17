import React from 'react';
import { Download, Share2, Copy } from 'lucide-react';

interface ExportBarProps {
  pngDataUrl: string;
  svgString: string;
  showExport: boolean;
  onDownloadSvg: () => void;
  onDownloadPng: () => void;
  onShare: () => void;
  onCopySvg: () => void;
}

export function ExportBar({
  pngDataUrl,
  svgString,
  showExport,
  onDownloadSvg,
  onDownloadPng,
  onShare,
  onCopySvg,
}: ExportBarProps) {
  if (!showExport) return null;

  const hasPng = !!pngDataUrl;
  const hasSvg = !!svgString;

  // Check Web Share API availability for "Save to Camera Roll" style.
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider">
      {hasSvg && (
        <button
          onClick={onCopySvg}
          className="inline-flex items-center gap-1 px-3 py-1.5 border border-black hover:bg-black hover:text-white transition-colors"
          title="Copy SVG to clipboard"
        >
          <Copy size={12} />
          Copy SVG
        </button>
      )}
      {hasSvg && (
        <button
          onClick={onDownloadSvg}
          className="inline-flex items-center gap-1 px-3 py-1.5 border border-black hover:bg-black hover:text-white transition-colors"
          title="Download SVG"
        >
          <Download size={12} />
          SVG
        </button>
      )}
      {hasPng && (
        <button
          onClick={onDownloadPng}
          className="inline-flex items-center gap-1 px-3 py-1.5 border border-black hover:bg-black hover:text-white transition-colors"
          title="Download PNG"
        >
          <Download size={12} />
          PNG
        </button>
      )}
      {canShare && hasPng && (
        <button
          onClick={onShare}
          className="inline-flex items-center gap-1 px-3 py-1.5 border border-black hover:bg-black hover:text-white transition-colors"
          title="Share (Save to Camera Roll)"
        >
          <Share2 size={12} />
          Share
        </button>
      )}
    </div>
  );
}
