import React, { useState } from 'react';
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
  selected: number | null;
}

/**
 * Interactive color boxes: single-click selects, double-click
 * opens native color picker. Deleted colors show an X badge.
 */
export function ColorPalette({
  palette,
  deletedColors,
  onToggleDelete,
  onSelect,
  selected,
}: ColorPaletteProps) {
  const [nativePickerIdx, setNativePickerIdx] = useState<number | null>(null);

  const handleDoubleClick = (idx: number, color: ColorBox) => {
    setNativePickerIdx(idx);
    const input = document.createElement('input');
    input.type = 'color';
    input.value = `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`;
    input.oninput = () => {
      const v = input.value;
      const r = parseInt(v.slice(1, 3), 16);
      const g = parseInt(v.slice(3, 5), 16);
      const b = parseInt(v.slice(5, 7), 16);
      onColorChange(idx, { r, g, b });
    };
    input.click();
  };

  const onColorChange = (idx: number, color: ColorBox) => {
    // Caller provides paletteOverrides via parent; here we just emit.
    // The actual override update lives in the parent hook.
    (window as any).__svg_mkr_override = (window as any).__svg_mkr_override || {};
    (window as any).__svg_mkr_override[idx] = color;
    // Notify via custom event so parent can react.
    window.dispatchEvent(new CustomEvent('palette-color-change', { detail: { idx, color } }));
    setNativePickerIdx(null);
  };

  if (!palette || palette.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {palette.map((p, i) => {
        const isDeleted = deletedColors.includes(i);
        const hex = `#${p.r.toString(16).padStart(2, '0')}${p.g.toString(16).padStart(2, '0')}${p.b.toString(16).padStart(2, '0')}`;
        return (
          <div
            key={i}
            onClick={() => onSelect(i)}
            onDoubleClick={() => handleDoubleClick(i, p)}
            className={`relative w-8 h-8 border cursor-pointer transition-all ${
              isDeleted ? 'opacity-25' : ''
            } ${selected === i ? 'ring-2 ring-black' : 'hover:brightness-110'}`}
            style={{ backgroundColor: hex }}
            title={`Color ${i + 1}: ${hex}`}
          >
            {isDeleted && (
              <div className="absolute inset-0 flex items-center justify-center text-red-600">
                <X size={12} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
