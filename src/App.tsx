import React from 'react';
import { ImageEditor } from './ImageEditor';
import './index.css';

export default function App() {
  return (
    <div className="min-h-screen bg-white text-black font-sans text-xs overflow-hidden">
      <header className="border-b border-black flex items-center justify-between px-4 h-[50px] shrink-0 bg-white z-50">
        <div className="font-bold text-[18px] tracking-tighter">SVG_MKR</div>
        <div className="text-[11px] flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-black rounded-full inline-block"></span>
          IMAGE_TO_SVG
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4">
        <ImageEditor onSave={(data) => {
          // Trigger download for both formats
          if (data.svg) {
            const blob = new Blob([data.svg], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'svg-mkr-output.svg';
            a.click();
            URL.revokeObjectURL(url);
          }
          if (data.png) {
            const a = document.createElement('a');
            a.href = data.png;
            a.download = 'svg-mkr-output.png';
            a.click();
          }
        }} />
      </main>
      
      <footer className="border-t border-black flex items-center justify-center px-4 h-[40px] bg-black text-white">
        <span className="text-[10px]">SVG_MKR 2024 — Image to SVG converter</span>
      </footer>
    </div>
  );
}
