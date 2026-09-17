import { useRef, useState } from 'react';
import { Upload, Camera } from 'lucide-react';

interface Props {
  onFile: (file: File) => void;
}

/**
 * Centered upload control matching OKPalette's aesthetic:
 * - Large white rectangular upload area
 * - Black monospace text
 * - Files / Camera pickers via a pop-over menu
 * - Full-page drag-and-drop handled by Landing
 */
export function UploadZone({ onFile }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    if (file.type.startsWith('image/')) {
      onFile(file);
      setShowMenu(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*;capture=environment"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      <div
        className={`
          relative border-2 border-black rounded-sm py-16 px-8
          flex flex-col items-center justify-center gap-4 cursor-pointer
          transition-all duration-200
          ${
            isDragging
              ? 'bg-black text-white scale-[1.02]'
              : 'bg-white hover:bg-[#fafafa]'
          }
        `}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => setShowMenu(true)}
      >
        <Upload className="w-6 h-6 text-[#0a0f0f]" />
        <span className="text-[#0a0f05] font-mono text-[13px] font-bold uppercase tracking-wider">
          Upload Image
        </span>
        <span className="text-[#0a0f05] font-mono text-[10px] opacity-50">
          or drag &amp; drop • ⌘V
        </span>
      </div>

      {showMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white border-2 border-black rounded-sm overflow-hidden min-w-[220px]">
            <div className="px-4 py-3 border-b border-black font-mono text-[11px] uppercase tracking-widest text-[#0a0f05]">
              SELECT SOURCE
            </div>
            <button
              onClick={() => {
                fileInputRef.current?.click();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-black hover:text-white transition-colors border-b border-black/10"
            >
              <Upload size={18} />
              <div className="flex flex-col">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide">
                  From Files
                </span>
                <span className="font-mono text-[9px] opacity-60">
                  Browse your device
                </span>
              </div>
            </button>
            <button
              onClick={() => {
                cameraInputRef.current?.click();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-black hover:text-white transition-colors"
            >
              <Camera size={18} />
              <div className="flex flex-col">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide">
                  From Camera
                </span>
                <span className="font-mono text-[9px] opacity-60">
                  Take a new photo
                </span>
              </div>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
