/// <reference types="vite/client" />

/**
 * imagetracerjs ships without TypeScript types.
 * Minimal declaration so the core module compiles cleanly.
 */
declare module 'imagetracerjs' {
  export interface ImageTracerOptions {
    numberofcolors?: number;
    pathomit?: number;
    pathprecision?: number;
    ltres?: number;
    qtres?: number;
    scale?: number;
    viewbox?: boolean;
    [key: string]: unknown;
  }

  export function imageToSVG(
    url: string,
    callback: (svg: string) => void,
    options?: ImageTracerOptions,
  ): void;

  export function loadImage(
    url: string,
    callback: (canvas: HTMLCanvasElement) => void,
    options?: ImageTracerOptions,
  ): void;

  export function imagedataToSVG(
    imagedata: ImageData,
    callback: (svg: string) => void,
    options?: ImageTracerOptions,
  ): void;

  const ImageTracer: {
    imageToSVG: typeof imageToSVG;
    loadImage: typeof loadImage;
    imagedataToSVG: typeof imagedataToSVG;
    [key: string]: unknown;
  };

  export default ImageTracer;
}
