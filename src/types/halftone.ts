/**
 * Available dot shapes for halftone rendering.
 */
export type DotShape = 'round' | 'square' | 'ellipse' | 'diamond' | 'line';

/**
 * Processing methods for halftone or bitmap conversion.
 */
export type ProcessingMethod = 'halftone' | 'threshold' | 'dither';

/**
 * Dithering algorithms.
 */
export type DitherType = 'floyd-steinberg' | 'ordered';


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
  /** Grid cell size in pixels (1–50) */
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
  /** Make near-white dots transparent (for DTF) */
  makeWhiteTransparent: boolean;
  /** Luminance threshold below which pixels are considered "black" (0–1) */
  blackThreshold: number;
  /** Supersampling factor for anti-aliasing (1, 2, or 4) */
  supersample: number;
  /** Maximum resolution before auto-resize */
  maxResolution: number;
  /** Enable automatic resize for large images */
  autoResize: boolean;
  /** Target background type ('light' for white paper, 'dark' for black shirts) */
  targetBackground: 'light' | 'dark';
  /** Brightness boost for highlights (1.0 = normal, >1.0 = punchier whites) */
  brightnessBoost: number;
  /** Garment/Support color for preview (e.g. #FFFFFF for white shirt) */
  supportColor: string;
  /** Show checkerboard behind the image in preview */
  showCheckerboard: boolean;
  /** Enable garment mockup mode */
  mockupMode: boolean;
  /** Input Levels: Black point (0–255) */
  levelsBlack: number;
  /** Input Levels: Mid point / Gamma (0.01–9.99) */
  levelsMid: number;
  /** Input Levels: White point (0–255) */
  levelsWhite: number;
  /** Output Levels: Black point (0–255) */
  outputLevelsBlack: number;
  /** Output Levels: White point (0–255) */
  outputLevelsWhite: number;
  /** Target Frequency in Lines Per Inch (LPI) */
  frequency: number;
  /** Image resolution for LPI calculation */
  dpi: number;
  /** Primary processing method */
  method: ProcessingMethod;
  /** Dithering algorithm (if method is 'dither') */
  ditherType: DitherType;
  /** Conversion threshold level (0–255) for 'threshold' method */
  thresholdLevel: number;
  /** Luminance threshold above which pixels are considered "white" (0–1) */
  whiteThreshold: number;
  /** Scale factor for ordered dither pattern (1, 2, 4) */
  ditherScale: number;
}

/**
 * Default halftone settings.
 */
export const DEFAULT_SETTINGS: HalftoneSettings = {
  gridSize: 2,
  angle: 30,
  maxDotRadius: 1,
  density: 2.0,
  threshold: 1.0,
  manualValues: {
    size: 2,
    density: 2.0,
    threshold: 1.0,
    smoothing: 1,
  },
  useManualValues: false,
  dotShape: 'round',
  preserveColor: true,
  makeBlackTransparent: true,
  makeWhiteTransparent: false,
  blackThreshold: 0.15,
  supersample: 1,
  maxResolution: 2500,
  autoResize: true,
  targetBackground: 'dark',
  brightnessBoost: 1.0,
  supportColor: '#1a1a1a',
  showCheckerboard: false,
  mockupMode: false,
  levelsBlack: 0,
  levelsMid: 1.0,
  levelsWhite: 255,
  outputLevelsBlack: 0,
  outputLevelsWhite: 255,
  frequency: 30,
  dpi: 300,
  method: 'halftone',
  ditherType: 'floyd-steinberg',
  thresholdLevel: 128,
  whiteThreshold: 0.95,
  ditherScale: 1,
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
