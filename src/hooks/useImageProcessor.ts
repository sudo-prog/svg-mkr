import { useState, useCallback } from 'react';
import { processImage, ProcessOptions, ProcessResult } from '../core/imageToSvgCore';

/**
 * React hook wrapping the pure imageToSvgCore pipeline.
 * Holds the base canvas (for erasures/wand) and the processed display canvas.
 * Re-runs processImage whenever options change.
 */
export function useImageProcessor() {
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // base canvas holds raw image + any erasures/wand applied by the user.
  const [baseCanvas, setBaseCanvas] = useState<HTMLCanvasElement | null>(null);

  const [options, setOptions] = useState<ProcessOptions>({
    colorCount: 4,
    hue: 0,
    saturation: 100,
    grayscale: false,
    invert: false,
    threshold: null,
    halftone: false,
    halftoneSize: 4,
    deletedColors: [],
    paletteOverrides: undefined,
  });

  const updateOptions = useCallback((partial: Partial<ProcessOptions>) => {
    setOptions(prev => ({ ...prev, ...partial }));
  }, []);

  /**
   * Load an image source (data-URL / blob-URL / file) into a base canvas
   * sized to max 1024px (handled inside core), then run the pipeline.
   */
  const loadImage = useCallback(
    async (source: string) => {
      setLoading(true);
      setError(null);

      const img = new Image();
      if (!source.startsWith('data:') && !source.startsWith('blob:')) {
        img.crossOrigin = 'Anonymous';
      }
      img.onload = async () => {
        let width = img.width;
        let height = img.height;
        const ratio = Math.min(1024 / width, 1024 / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const bc = document.createElement('canvas');
        bc.width = width;
        bc.height = height;
        const ctx = bc.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setError('Canvas error');
          setLoading(false);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        setBaseCanvas(bc);

        try {
          const res = await processImage(bc.toDataURL('image/png'), options);
          setResult(res);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setLoading(false);
        }
      };
      img.onerror = () => {
        setError('Failed to load image');
        setLoading(false);
      };
      img.src = source;
    },
    [options],
  );

  // Re-process whenever base canvas or options change.
  const reprocess = useCallback(async () => {
    if (!baseCanvas) return;
    setLoading(true);
    setError(null);
    try {
      const res = await processImage(baseCanvas.toDataURL('image/png'), options);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [baseCanvas, options]);

  return {
    result,
    loading,
    error,
    options,
    updateOptions,
    loadImage,
    reprocess,
    baseCanvas,
  };
}
