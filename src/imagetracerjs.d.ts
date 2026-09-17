declare module 'imagetracerjs' {
  export interface ImageTracerOptions {
    pathprecision?: number;
    scale?: number;
    [key: string]: unknown;
  }
  export function imageToSVG(
    url: string,
    callback: (svg: string) => void,
    options?: ImageTracerOptions,
  ): void;
  const ImageTracer: {
    imageToSVG: typeof imageToSVG;
    loadImage: (url: string, cb: (canvas: HTMLCanvasElement) => void) => void;
    imagedataToSVG: (
      imagedata: ImageData,
      callback: (svg: string) => void,
      options?: ImageTracerOptions,
    ) => void;
    [key: string]: unknown;
  };
  export default ImageTracer;
}
