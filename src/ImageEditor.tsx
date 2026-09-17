import React, { useState, useRef, useEffect } from 'react';
import { X, Eraser, Wand2, MousePointer2, Save, Upload, Download } from 'lucide-react';
import ImageTracer from 'imagetracerjs';

interface ImageEditorProps {
  onSave?: (data: { png: string; svg: string }) => void;
}

export function ImageEditor({ onSave }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [grayscale, setGrayscale] = useState(false);
  const [invert, setInvert] = useState(false);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [halftone, setHalftone] = useState(false);
  const [halftoneSize, setHalftoneSize] = useState(4);
  
  const [tool, setTool] = useState<'select' | 'erase' | 'magicWand'>('select');
  const [brushSize, setBrushSize] = useState(20);
  const [wandTolerance, setWandTolerance] = useState(32);
  
  const [useQuantize, setUseQuantize] = useState(false);
  const [colorCount, setColorCount] = useState(4);
  const [palette, setPalette] = useState<{r: number, g: number, b: number}[]>([]);
  const [deletedColors, setDeletedColors] = useState<number[]>([]);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    if (!imageSrc.startsWith('data:') && !imageSrc.startsWith('blob:')) {
      img.crossOrigin = "Anonymous";
    }
    img.onload = () => {
      const bc = baseCanvasRef.current;
      
      let width = img.width;
      let height = img.height;
      const MAX_SIZE = 1024;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      bc.width = width;
      bc.height = height;
      const ctx = bc.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, width, height);
      renderCanvas();
      setIsLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    if (!useQuantize) {
      setPalette([]);
      setDeletedColors([]);
      return;
    }
    
    const bc = baseCanvasRef.current;
    if (!bc || bc.width === 0) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = bc.width;
    tempCanvas.height = bc.height;
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    let filterStr = `hue-rotate(${hue}deg) saturate(${saturation}%)`;
    if (grayscale) filterStr += ` grayscale(100%)`;
    if (invert) filterStr += ` invert(100%)`;
    ctx.filter = filterStr;
    ctx.drawImage(bc, 0, 0);
    
    const scale = Math.min(1, 100 / Math.max(bc.width, bc.height));
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = Math.max(1, Math.floor(bc.width * scale));
    smallCanvas.height = Math.max(1, Math.floor(bc.height * scale));
    const sCtx = smallCanvas.getContext('2d', { willReadFrequently: true });
    if (!sCtx) return;
    sCtx.drawImage(tempCanvas, 0, 0, smallCanvas.width, smallCanvas.height);
    const data = sCtx.getImageData(0, 0, smallCanvas.width, smallCanvas.height).data;
    
    const colorMap = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] < 128) continue;
      const r = data[i]; const g = data[i+1]; const b = data[i+2];
      const key = (Math.floor(r/16) << 16) | (Math.floor(g/16) << 8) | Math.floor(b/16);
      if (colorMap.has(key)) {
        colorMap.get(key).count++;
      } else {
        colorMap.set(key, {r, g, b, count: 1});
      }
    }
    
    const sorted = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
    const newPalette = [];
    for (const c of sorted) {
      if (newPalette.length >= colorCount) break;
      let tooClose = false;
      for (const p of newPalette) {
        const dist = Math.sqrt(Math.pow(c.r-p.r, 2) + Math.pow(c.g-p.g, 2) + Math.pow(c.b-p.b, 2));
        if (dist < 30) { tooClose = true; break; }
      }
      if (!tooClose) newPalette.push({r: c.r, g: c.g, b: c.b});
    }
    for (const c of sorted) {
      if (newPalette.length >= colorCount) break;
      if (!newPalette.find(p => p.r === c.r && p.g === c.g && p.b === c.b)) {
        newPalette.push({r: c.r, g: c.g, b: c.b});
      }
    }
    setPalette(newPalette);
    setDeletedColors([]);
  }, [useQuantize, colorCount, hue, saturation, grayscale, invert]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const bc = baseCanvasRef.current;
    if (!canvas || !bc || bc.width === 0) return;
    
    canvas.width = bc.width;
    canvas.height = bc.height;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply basic CSS filters on context
    let filterStr = `hue-rotate(${hue}deg) saturate(${saturation}%)`;
    if (grayscale) filterStr += ` grayscale(100%)`;
    if (invert) filterStr += ` invert(100%)`;
    ctx.filter = filterStr;
    
    ctx.drawImage(bc, 0, 0);
    ctx.filter = 'none';

    // Apply quantization
    if (useQuantize && palette.length > 0) {
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] === 0) continue;
        let r = data[i], g = data[i+1], b = data[i+2];
        let minDist = Infinity;
        let bestIdx = 0;
        for (let j = 0; j < palette.length; j++) {
          let p = palette[j];
          let dist = Math.pow(r-p.r, 2) + Math.pow(g-p.g, 2) + Math.pow(b-p.b, 2);
          if (dist < minDist) {
            minDist = dist;
            bestIdx = j;
          }
        }
        if (deletedColors.includes(bestIdx)) {
          data[i+3] = 0; // transparent
        } else {
          data[i] = palette[bestIdx].r;
          data[i+1] = palette[bestIdx].g;
          data[i+2] = palette[bestIdx].b;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // Apply pixel-level filters (threshold, halftone)
    if (threshold !== null || halftone) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      if (halftone) {
        const size = halftoneSize;
        for (let y = 0; y < canvas.height; y += size) {
          for (let x = 0; x < canvas.width; x += size) {
            let total = 0;
            let count = 0;
            for (let dy = 0; dy < size; dy++) {
              for (let dx = 0; dx < size; dx++) {
                if (x + dx < canvas.width && y + dy < canvas.height) {
                  const idx = ((y + dy) * canvas.width + (x + dx)) * 4;
                  total += (data[idx] + data[idx+1] + data[idx+2]) / 3;
                  count++;
                }
              }
            }
            const avg = total / count;
            const radius = (1 - (avg / 255)) * (size / 2);
            
            for (let dy = 0; dy < size; dy++) {
              for (let dx = 0; dx < size; dx++) {
                if (x + dx < canvas.width && y + dy < canvas.height) {
                  const idx = ((y + dy) * canvas.width + (x + dx)) * 4;
                  const dist = Math.sqrt(Math.pow(dx - size/2, 2) + Math.pow(dy - size/2, 2));
                  const isDot = dist < radius;
                  const color = isDot ? 0 : 255;
                  data[idx] = data[idx+1] = data[idx+2] = color;
                }
              }
            }
          }
        }
      } else if (threshold !== null) {
        for (let i = 0; i < data.length; i += 4) {
          if (data[i+3] === 0) continue;
          const avg = (data[i] + data[i+1] + data[i+2]) / 3;
          const v = avg >= threshold ? 255 : 0;
          data[i] = data[i+1] = data[i+2] = v;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }
  };

  useEffect(() => {
    renderCanvas();
  }, [hue, saturation, grayscale, invert, threshold, halftone, halftoneSize, useQuantize, palette, deletedColors]);

  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const floodFill = (startX: number, startY: number, tolerance: number) => {
    const bc = baseCanvasRef.current;
    const ctx = bc.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    startX = Math.floor(startX);
    startY = Math.floor(startY);

    const imgData = ctx.getImageData(0, 0, bc.width, bc.height);
    const data = imgData.data;
    const width = bc.width;
    const height = bc.height;

    const startPos = (startY * width + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    if (startA === 0) return;

    const matchStartColor = (pos: number) => {
      const r = data[pos];
      const g = data[pos + 1];
      const b = data[pos + 2];
      const a = data[pos + 3];
      if (a === 0) return false;
      return (
        Math.abs(r - startR) <= tolerance &&
        Math.abs(g - startG) <= tolerance &&
        Math.abs(b - startB) <= tolerance &&
        Math.abs(a - startA) <= tolerance
      );
    };

    const stack = [[startX, startY]];
    const seen = new Uint8Array(width * height);
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      let y1 = y;
      
      while (y1 >= 0 && matchStartColor((y1 * width + x) * 4)) {
        y1--;
      }
      y1++;
      
      let spanLeft = false;
      let spanRight = false;
      
      while (y1 < height && matchStartColor((y1 * width + x) * 4)) {
        const pos = (y1 * width + x) * 4;
        data[pos + 3] = 0;
        seen[y1 * width + x] = 1;
        
        if (!spanLeft && x > 0 && matchStartColor((y1 * width + (x - 1)) * 4) && !seen[y1 * width + (x - 1)]) {
          stack.push([x - 1, y1]);
          spanLeft = true;
        } else if (spanLeft && x > 0 && !matchStartColor((y1 * width + (x - 1)) * 4)) {
          spanLeft = false;
        }
        
        if (!spanRight && x < width - 1 && matchStartColor((y1 * width + (x + 1)) * 4) && !seen[y1 * width + (x + 1)]) {
          stack.push([x + 1, y1]);
          spanRight = true;
        } else if (spanRight && x < width - 1 && !matchStartColor((y1 * width + (x + 1)) * 4)) {
          spanRight = false;
        }
        y1++;
      }
    }
    
    ctx.putImageData(imgData, 0, 0);
    renderCanvas();
  };

  const drawErase = (x: number, y: number) => {
    const bc = baseCanvasRef.current;
    const ctx = bc.getContext('2d');
    if (!ctx) return;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    renderCanvas();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);
    if (tool === 'magicWand') {
      floodFill(pos.x, pos.y, wandTolerance);
    } else if (tool === 'erase') {
      setIsDrawing(true);
      drawErase(pos.x, pos.y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool !== 'erase') return;
    const pos = getCanvasPos(e);
    drawErase(pos.x, pos.y);
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const handleSave = () => {
    if (canvasRef.current) {
      const png = canvasRef.current.toDataURL('image/png');
      onSave?.({ png, svg: '' });
    }
  };

  const handleSaveSvg = () => {
    if (!canvasRef.current || !imageSrc) return;
    
    const bc = baseCanvasRef.current;
    ImageTracer.imageToSVG(bc.toDataURL('image/png'), (svg: string) => {
      onSave?.({ png: canvasRef.current!.toDataURL('image/png'), svg });
    });
  };

  const handleDownloadSvg = () => {
    if (!canvasRef.current || !imageSrc) return;
    
    const bc = baseCanvasRef.current;
    ImageTracer.imageToSVG(bc.toDataURL('image/png'), (svg: string) => {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'svg-mkr-output.svg';
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col border border-black mb-3 bg-white">
      <div className="flex items-center justify-between p-2 border-b border-black bg-[#f0f0f0]">
        <h2 className="text-[10px] font-bold uppercase tracking-widest">SVG_MKR</h2>
        <div className="flex gap-1">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="file-input"
          />
          <label htmlFor="file-input" className="cursor-pointer hover:text-blue-600">
            <Upload size={14} />
          </label>
          {!isLoaded && (
            <label className="cursor-pointer hover:text-blue-600">
              <X size={14} />
            </label>
          )}
        </div>
      </div>
      
      {!isLoaded ? (
        <div 
          className="bg-[#e5e5e5] flex items-center justify-center p-2 relative h-[200px] border-2 border-dashed border-black/20"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <Upload size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-[10px] uppercase">Drop image or click to upload</p>
            <p className="text-[8px] opacity-50 mt-1">PNG, JPG, WebP supported</p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-[#e5e5e5] flex items-center justify-center p-2 relative"
             style={{
                cursor: tool === 'magicWand' ? 'crosshair' : tool === 'erase' ? 'crosshair' : 'default'
              }}>
            <canvas 
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="max-w-full max-h-full object-contain shadow-sm"
            />
          </div>

          <div className="p-3 border-t border-black flex flex-col gap-4 overflow-y-auto max-h-[300px] bg-[#fcfcfc]">
            {/* Tools */}
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-bold opacity-60">TOOLS</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setTool('select')}
                  className={`flex-1 p-2 border border-black flex justify-center items-center ${tool === 'select' ? 'bg-black text-white' : 'hover:bg-[#f0f0f0]'}`}
                >
                  <MousePointer2 size={12} />
                </button>
                <button 
                  onClick={() => setTool('erase')}
                  className={`flex-1 p-2 border border-black flex justify-center items-center ${tool === 'erase' ? 'bg-black text-white' : 'hover:bg-[#f0f0f0]'}`}
                >
                  <Eraser size={12} />
                </button>
                <button 
                  onClick={() => setTool('magicWand')}
                  className={`flex-1 p-2 border border-black flex justify-center items-center ${tool === 'magicWand' ? 'bg-black text-white' : 'hover:bg-[#f0f0f0]'}`}
                >
                  <Wand2 size={12} />
                </button>
              </div>
              
              {tool === 'erase' && (
                <div className="pt-2">
                  <div className="flex justify-between text-[9px] mb-1">
                    <span>BRUSH_SIZE</span>
                    <span>{brushSize}px</span>
                  </div>
                  <input type="range" min="1" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full accent-black h-1" />
                </div>
              )}
              {tool === 'magicWand' && (
                <div className="pt-2">
                  <div className="flex justify-between text-[9px] mb-1">
                    <span>TOLERANCE</span>
                    <span>{wandTolerance}</span>
                  </div>
                  <input type="range" min="0" max="255" value={wandTolerance} onChange={(e) => setWandTolerance(parseInt(e.target.value))} className="w-full accent-black h-1" />
                  <div className="text-[9px] opacity-50 mt-1 italic">Click on background to remove</div>
                </div>
              )}
            </div>
            
            <hr className="border-black/20" />
            
            {/* Color Separation */}
            <div className="space-y-3">
              <label className="text-[9px] uppercase font-bold opacity-60">COLOR_SEPARATION</label>
              
              <label className="flex items-center gap-1 text-[10px] cursor-pointer mb-2">
                <input type="checkbox" checked={useQuantize} onChange={(e) => setUseQuantize(e.target.checked)} />
                ENABLE_QUANTIZATION
              </label>
              {useQuantize && (
                <>
                  <div>
                    <div className="flex justify-between text-[9px] mb-1">
                      <span>COLOR_COUNT</span>
                      <span>{colorCount}</span>
                    </div>
                    <input type="range" min="2" max="16" value={colorCount} onChange={(e) => setColorCount(parseInt(e.target.value))} className="w-full accent-black h-1" />
                  </div>
                  
                  {palette.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[9px] opacity-50 italic mb-2">Click color to delete/restore</div>
                      <div className="grid grid-cols-4 gap-2">
                        {palette.map((p, i) => {
                          const isDeleted = deletedColors.includes(i);
                          return (
                            <div 
                              key={i} 
                              onClick={() => {
                                if (isDeleted) {
                                  setDeletedColors(deletedColors.filter(d => d !== i));
                                } else {
                                  setDeletedColors([...deletedColors, i]);
                                }
                              }}
                              className="w-full aspect-square border border-black cursor-pointer relative"
                              style={{ backgroundColor: `rgb(${p.r}, ${p.g}, ${p.b})`, opacity: isDeleted ? 0.2 : 1 }}
                            >
                              {isDeleted && (
                                <div className="absolute inset-0 flex items-center justify-center text-red-600">
                                  <X size={14} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <hr className="border-black/20" />
            
            {/* Filters */}
            <div className="space-y-3">
              <label className="text-[9px] uppercase font-bold opacity-60">FILTERS</label>
              
              <div>
                <div className="flex justify-between text-[9px] mb-1">
                  <span>HUE</span>
                  <span>{hue}deg</span>
                </div>
                <input type="range" min="-180" max="180" value={hue} onChange={(e) => setHue(parseInt(e.target.value))} className="w-full accent-black h-1" />
              </div>
              
              <div>
                <div className="flex justify-between text-[9px] mb-1">
                  <span>SATURATION</span>
                  <span>{saturation}%</span>
                </div>
                <input type="range" min="0" max="200" value={saturation} onChange={(e) => setSaturation(parseInt(e.target.value))} className="w-full accent-black h-1" />
              </div>
              
              <div className="flex gap-4 text-[10px]">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={grayscale} onChange={(e) => setGrayscale(e.target.checked)} />
                  B&W
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
                  INVERT
                </label>
              </div>
              <div>
                <div className="flex justify-between text-[9px] mb-1">
                  <span>THRESHOLD</span>
                  <span>{threshold === null ? 'OFF' : threshold}</span>
                </div>
                <input type="range" min="0" max="255" value={threshold === null ? 0 : threshold} 
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setThreshold(val === 0 ? null : val);
                    if (val > 0) setHalftone(false);
                  }} 
                  className="w-full accent-black h-1" 
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[10px] cursor-pointer mb-2">
                  <input type="checkbox" checked={halftone} onChange={(e) => {
                    setHalftone(e.target.checked);
                    if (e.target.checked) setThreshold(null);
                  }} />
                  HALFTONE
                </label>
                {halftone && (
                  <>
                    <div className="flex justify-between text-[9px] mb-1 mt-2">
                      <span>SIZE</span>
                      <span>{halftoneSize}px</span>
                    </div>
                    <input type="range" min="2" max="20" value={halftoneSize} onChange={(e) => setHalftoneSize(parseInt(e.target.value))} className="w-full accent-black h-1" />
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-2 border-t border-black flex justify-end bg-[#f0f0f0]">
            <div className="flex gap-2">
              <button 
                onClick={handleSaveSvg}
                disabled={!isLoaded}
                className={`py-1.5 px-3 ${isLoaded ? 'bg-black hover:bg-black/80' : 'bg-gray-400 cursor-not-allowed'} text-white text-[10px] uppercase font-bold transition-colors`}
              >
                SAVE_SVG
              </button>
              <button 
                onClick={handleDownloadSvg}
                disabled={!isLoaded}
                className={`py-1.5 px-3 ${isLoaded ? 'bg-black hover:bg-black/80' : 'bg-gray-400 cursor-not-allowed'} text-white text-[10px] uppercase font-bold transition-colors`}
              >
                DOWNLOAD_SVG
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
