/**
 * Available dot shapes for halftone rendering.
 */
export type DotShape = 'round' | 'square' | 'ellipse' | 'diamond' | 'line';

/**
 * Manual override values for fine-tuning halftone output.
 */
export interface ManualValues {
  size: number;
  density: number;
  threshold: number;
  smoothing: number;
}

/**
 * Complete halftone processing settings.
 */
export interface HalftoneSettings {
  /** Grid cell size in pixels (4–50) */
  gridSize: number;
  /** Rotation angle of the halftone grid in degrees (0–360) */
  angle: number;
  /** Maximum dot radius in pixels (1–25) */
  maxDotRadius: number;
  /** Density/intensity multiplier (0.1–2.0) */
  density: number;
  /** Luminance threshold — skip dots lighter than this (0–1) */
  threshold: number;
  /** Manual override values */
  manualValues: ManualValues;
  /** Use manual values instead of computed ones */
  useManualValues: boolean;
  /** Dot shape type */
  dotShape: DotShape;
  /** Preserve original color in dots */
  preserveColor: boolean;
  /** Make near-black dots transparent (for DTF) */
  makeBlackTransparent: boolean;
  /** Luminance threshold below which pixels are considered "black" (0–1) */
  blackThreshold: number;
  /** Supersampling factor for anti-aliasing (1, 2, or 4) */
  supersample: number;
  /** Maximum resolution before auto-resize */
  maxResolution: number;
  /** Enable automatic resize for large images */
  autoResize: boolean;
}

/**
 * Default halftone settings.
 */
export const DEFAULT_SETTINGS: HalftoneSettings = {
  gridSize: 12,
  angle: 45,
  maxDotRadius: 6,
  density: 0.8,
  threshold: 0.5,
  manualValues: {
    size: 12,
    density: 0.8,
    threshold: 0.5,
    smoothing: 1,
  },
  useManualValues: false,
  dotShape: 'round',
  preserveColor: true,
  makeBlackTransparent: false,
  blackThreshold: 0.15,
  supersample: 1,
  maxResolution: 2500,
  autoResize: true,
};

/**
 * Message sent from main thread to the halftone worker.
 */
export interface WorkerMessage {
  type: 'process';
  imageData: ArrayBuffer;
  width: number;
  height: number;
  settings: HalftoneSettings;
}

/**
 * Response sent from halftone worker back to main thread.
 */
export interface WorkerResponse {
  type: 'progress' | 'complete' | 'error';
  progress?: number;
  imageData?: ArrayBuffer;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Image metadata returned after loading.
 */
export interface ImageInfo {
  originalWidth: number;
  originalHeight: number;
  displayWidth: number;
  displayHeight: number;
  fileSize: number;
  fileName: string;
}
