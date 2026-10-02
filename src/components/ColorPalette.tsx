import React from 'react';
import { X } from 'lucide-react';

interface ColorBox {
  r: number;
  g: number;
  b: number;
}

interface ColorPaletteProps {
  palette: ColorBox[];
  deletedColors: number[];
  onToggleDelete: (index: number) => void;
  onSelect: (index: number) => void;
  onColorChange: (index: number, color: ColorBox) => void;
  selected: number | null;
}

function toHex({ r, g, b }: ColorBox): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Interactive color boxes:
 * - single-click selects
 * - double-click opens native color picker and updates the palette
 * - deleted colors show an X badge and reduced opacity
 */
export function ColorPalette({
  palette,
  deletedColors,
  onToggleDelete,
  onSelect,
  onColorChange,
  selected,
}: ColorPaletteProps) {
  const handleDoubleClick = (idx: number, color: ColorBox) => {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = toHex(color);
    input.oninput = () => {
      const v = input.value;
      const r = parseInt(v.slice(1, 3), 16);
      const g = parseInt(v.slice(3, 5), 16);
      const b = parseInt(v.slice(5, 7), 16);
      onColorChange(idx, { r, g, b });
    };
    input.click();
  };

  if (!palette || palette.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {palette.map((p, i) => {
        const isDeleted = deletedColors.includes(i);
        const hex = toHex(p);
        return (
          <div
            key={i}
            onClick={() => onSelect(i)}
            onDoubleClick={() => handleDoubleClick(i, p)}
            className={`relative w-9 h-9 border border-black cursor-pointer transition-all ${
              isDeleted ? 'opacity-30' : ''
            } ${selected === i ? 'ring-2 ring-offset-1 ring-black' : 'hover:brightness-110'}`}
            style={{ backgroundColor: hex }}
            title={`${hex} — click select, double-click edit`}
          >
            {isDeleted && (
              <div className="absolute inset-0 flex items-center justify-center text-red-600 bg-white/40">
                <X size={14} strokeWidth={2.5} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
