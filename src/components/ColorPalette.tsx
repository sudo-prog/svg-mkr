import { useState } from 'react';
import { Eraser, Circle, Square, Waves } from 'lucide-react';

export interface PaletteColor {
  r: number;
  g: number;
  b: number;
  hex: string;
}

type LayerEffect = 'halftone' | 'distressed' | 'outline' | null;

interface Props {
  colors: PaletteColor[];
  selectedIndex: number | null;
  deletedIndices: number[];
  onSelect: (index: number) => void;
  onRecolor: (index: number, hex: string) => void;
  onDelete: (index: number) => void;
  onEffect: (index: number, effect: LayerEffect) => void;
  activeEffect: Record<number, LayerEffect>;
}

/**
 * Interactive color boxes (12×12) with select / recolor / delete / effects.
 * - Click → select
 * - Double-click → native color picker (recolor)
 * - Deleted colors → transparent with an X badge
 * - LAYER panel → per-layer halftone / distressed / outline / delete
 */
export function ColorPalette({
  colors,
  selectedIndex,
  deletedIndices,
  onSelect,
  onRecolor,
  onDelete,
  onEffect,
  activeEffect,
}: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {/* Color boxes */}
      <div className="flex flex-wrap gap-2">
        {colors.map((color, i) => {
          const isDeleted = deletedIndices.includes(i);
          const isSelected = selectedIndex === i;

          return (
            <div key={i} className="relative">
              <div
                onClick={() => onSelect(i)}
                onDoubleClick={() => setEditingIndex(i)}
                className={`
                  w-12 h-12 border-2 transition-all cursor-pointer
                  ${isSelected ? 'border-black scale-110 shadow-md' : 'border-black/30'}
                  ${isDeleted ? 'opacity-30' : ''}
                `}
                style={{ backgroundColor: isDeleted ? 'transparent' : color.hex }}
                title={`Color ${i + 1} – double-click to recolor`}
              />

              {isDeleted && (
                <div className="absolute inset-0 flex items-center justify-center text-[#0a0f05]">
                  <Eraser size={14} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Layer effects panel — only when a non-deleted color is selected */}
      {selectedIndex !== null && !deletedIndices.includes(selectedIndex) && (
        <div className="flex items-center gap-1 border-t border-black pt-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-[#0a0f05]/60 mr-2">
            LAYER
          </span>

          <button
            onClick={() =>
              onEffect(
                selectedIndex,
                activeEffect[selectedIndex] === 'halftone' ? null : 'halftone',
              )
            }
            className={`p-2 border border-black ${
              activeEffect[selectedIndex] === 'halftone'
                ? 'bg-black text-white'
                : 'hover:bg-black hover:text-white'
            } transition-colors`}
            title="Halftone"
          >
            <Waves size={14} />
          </button>

          <button
            onClick={() =>
              onEffect(
                selectedIndex,
                activeEffect[selectedIndex] === 'distressed' ? null : 'distressed',
              )
            }
            className={`p-2 border border-black ${
              activeEffect[selectedIndex] === 'distressed'
                ? 'bg-black text-white'
                : 'hover:bg-black hover:text-white'
            } transition-colors`}
            title="Distressed"
          >
            <Square size={14} />
          </button>

          <button
            onClick={() =>
              onEffect(
                selectedIndex,
                activeEffect[selectedIndex] === 'outline' ? null : 'outline',
              )
            }
            className={`p-2 border border-black ${
              activeEffect[selectedIndex] === 'outline'
                ? 'bg-black text-white'
                : 'hover:bg-black hover:text-white'
            } transition-colors`}
            title="Outline"
          >
            <Circle size={14} />
          </button>

          <button
            onClick={() => onDelete(selectedIndex)}
            className="p-2 border border-black hover:bg-black hover:text-white ml-auto transition-colors"
            title="Delete layer (Esc)"
          >
            <Eraser size={14} />
          </button>
        </div>
      )}

      {/* Hidden native color picker — appears on double-click */}
      {editingIndex !== null && (
        <input
          type="color"
          value={colors[editingIndex]?.hex || '#000000'}
          onChange={(e) => {
            onRecolor(editingIndex, e.target.value);
            setEditingIndex(null);
          }}
          onBlur={() => setEditingIndex(null)}
          className="absolute opacity-0 w-0 h-0"
          autoFocus
        />
      )}
    </div>
  );
}
