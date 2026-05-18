/**
 * Core halftone processing engine.
 * 
 * This module contains the main algorithm that transforms an image into
 * a halftone pattern. It works by:
 * 
 * 1. Overlaying a virtual grid on the source image (rotated by the angle setting)
 * 2. For each grid cell, sampling the average color and luminance
 * 3. Drawing a dot proportional to the darkness of that cell
 * 4. Optionally preserving color and handling transparency for DTF
 * 
 * The engine is designed to run inside a Web Worker to avoid blocking the UI.
 */

import type { HalftoneSettings } from '../types/halftone';
import { averageColor, isNearBlack, isNearWhite } from './color';
import { getDotDrawer } from './dot-shapes';

/**
 * Progress callback type.
 */
export type ProgressCallback = (progress: number) => void;

/**
 * Process an image with halftone effect.
 * 
 * @param sourceData - Raw RGBA pixel data of the source image
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param settings - Halftone processing settings
 * @param onProgress - Optional callback for progress updates (0–100)
 * @returns The processed image as RGBA pixel data
 */
/**
 * Helper to apply levels adjustment.
 */
export function applyLevels(v: number, black: number, white: number, mid: number, outBlack: number = 0, outWhite: number = 255): number {
  const b = black / 255;
  const w = white / 255;
  const diff = w - b;
  let res = diff !== 0 ? (v - b) / diff : (v >= b ? 1 : 0);
  res = Math.max(0, Math.min(1, res));
  if (mid !== 1.0 && res > 0 && res < 1) {
    res = Math.pow(res, 1 / mid);
  }
  
  // Apply output levels
  const ob = outBlack / 255;
  const ow = outWhite / 255;
  res = res * (ow - ob) + ob;
  
  return res;
}

export function processHalftone(
  sourceData: Uint8ClampedArray,
  width: number,
  height: number,
  settings: HalftoneSettings,
  onProgress?: ProgressCallback,
): Uint8ClampedArray {
  if (settings.method === 'threshold') {
    return processThreshold(sourceData, width, height, settings, onProgress);
  } else if (settings.method === 'dither') {
    return processDither(sourceData, width, height, settings, onProgress);
  }
  
  // Photoshop-style continuous spot function (Mask method)
  const outputData = new Uint8ClampedArray(width * height * 4);
  
  const effectiveGridSize = settings.useManualValues ? settings.manualValues.size : settings.gridSize;
  const effectiveDensity = settings.useManualValues ? settings.manualValues.density : settings.density;
  const effectiveThreshold = settings.useManualValues ? settings.manualValues.threshold : settings.threshold;
  
  const gridSize = Math.max(1, effectiveGridSize);
  // frequency (period = gridSize pixels)
  const freq = (2 * Math.PI) / gridSize;
  const angleRad = (settings.angle * Math.PI) / 180;
  const cos = Math.cos(-angleRad);
  const sin = Math.sin(-angleRad);
  
  // Anti-aliasing margin based on grid size for smooth dot edges
  const aa = Math.min(0.2, 1.5 / gridSize);

  for (let y = 0; y < height; y++) {
    if (onProgress && y % 50 === 0) {
      onProgress(Math.min(100, Math.round((y / height) * 100)));
    }
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = sourceData[idx];
      const g = sourceData[idx + 1];
      const b = sourceData[idx + 2];
      const a = sourceData[idx + 3];

      // Copy original RGB if preserving color
      if (settings.preserveColor) {
        outputData[idx] = r;
        outputData[idx + 1] = g;
        outputData[idx + 2] = b;
      } else {
        const ink = settings.targetBackground === 'dark' ? 255 : 0;
        outputData[idx] = outputData[idx + 1] = outputData[idx + 2] = ink;
      }

      if (a < 10) {
        outputData[idx + 3] = 0;
        continue;
      }

      // 1. Grayscale luminance of original pixel
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      
      // 2. Levels Adjustment
      const adjustedLum = applyLevels(lum, settings.levelsBlack, settings.levelsWhite, settings.levelsMid, settings.outputLevelsBlack, settings.outputLevelsWhite);
      
      // 3. Modulate for dark/light garment mask logic
      // For dark background: white stays opaque (rawIntensity = adjustedLum)
      // For light background: black stays opaque (rawIntensity = 1 - adjustedLum)
      const rawIntensity = settings.targetBackground === 'dark' ? adjustedLum : 1 - adjustedLum;
      
      // Apply density and brightness boosts to get the final threshold comparison value
      const intensity = Math.min(1, Math.max(0, rawIntensity * settings.brightnessBoost * effectiveDensity));

      // Quick aborts based on threshold setting (acts as a hard cutoff)
      if (intensity < (1 - effectiveThreshold)) {
        outputData[idx + 3] = 0;
        continue;
      }

      // Check near black/white transparency exceptions
      if (settings.makeBlackTransparent && isNearBlack(r, g, b, settings.blackThreshold)) {
        outputData[idx + 3] = 0;
        continue;
      }
      if (settings.makeWhiteTransparent && isNearWhite(r, g, b, settings.whiteThreshold)) {
        outputData[idx + 3] = 0;
        continue;
      }

      // 4. Generate spot function value
      const rotX = x * cos - y * sin;
      const rotY = x * sin + y * cos;
      let spot = 0;
      
      switch (settings.dotShape) {
        case 'line':
          spot = Math.cos(rotX * freq);
          break;
        case 'ellipse':
          spot = (Math.cos(rotX * freq) + Math.cos(rotY * freq * 0.5)) / 2;
          break;
        case 'square':
          // Math.cos(x) * Math.cos(y) creates square/diamond dots
          spot = Math.cos(rotX * freq) * Math.cos(rotY * freq);
          break;
        case 'diamond':
          spot = Math.abs(Math.cos(rotX * freq)) + Math.abs(Math.cos(rotY * freq)) - 1;
          break;
        case 'round':
        default:
          spot = (Math.cos(rotX * freq) + Math.cos(rotY * freq)) / 2;
          break;
      }

      // Map spot from [-1, 1] to [0, 1]
      const spotThreshold = (spot + 1) / 2;
      
      // 5. Evaluate pixel masking with Anti-aliasing (smoothstep)
      let alphaMultiplier = 1;
      
      if (intensity < spotThreshold - aa) {
        alphaMultiplier = 0;
      } else if (intensity > spotThreshold + aa) {
        alphaMultiplier = 1;
      } else {
        const t = (intensity - (spotThreshold - aa)) / (aa * 2);
        alphaMultiplier = t * t * (3 - 2 * t);
      }
      
      outputData[idx + 3] = Math.round(a * alphaMultiplier);
    }
  }

  return outputData;
}

/**
 * Simple threshold processing with adjustable level.
 */
function processThreshold(
  sourceData: Uint8ClampedArray,
  width: number,
  height: number,
  settings: HalftoneSettings,
  onProgress?: ProgressCallback,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(width * height * 4);
  const threshold = settings.thresholdLevel / 255;

  for (let i = 0; i < sourceData.length; i += 4) {
    if (onProgress && i % (width * 40) === 0) {
      onProgress(Math.round((i / sourceData.length) * 100));
    }
    const a = sourceData[i + 3];
    if (a < 10) continue;

    const r = sourceData[i] / 255;
    const g = sourceData[i + 1] / 255;
    const b = sourceData[i + 2] / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    
    const adjustedLum = applyLevels(lum, settings.levelsBlack, settings.levelsWhite, settings.levelsMid, settings.outputLevelsBlack, settings.outputLevelsWhite);
    const value = (adjustedLum * settings.brightnessBoost) >= threshold ? 255 : 0;
    
    const ink = settings.targetBackground === 'dark' ? value : 255 - value;
    
    output[i] = output[i + 1] = output[i + 2] = ink;
    output[i + 3] = a;
  }
  return output;
}

/**
 * Dithering processing router.
 */
function processDither(
  sourceData: Uint8ClampedArray,
  width: number,
  height: number,
  settings: HalftoneSettings,
  onProgress?: ProgressCallback,
): Uint8ClampedArray {
  if (settings.ditherType === 'ordered') {
    return processOrderedDither(sourceData, width, height, settings, onProgress);
  }
  return processFloydSteinberg(sourceData, width, height, settings, onProgress);
}

/**
 * Floyd-Steinberg error diffusion dither.
 */
function processFloydSteinberg(
  sourceData: Uint8ClampedArray,
  width: number,
  height: number,
  settings: HalftoneSettings,
  onProgress?: ProgressCallback,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(width * height * 4);
  const buffer = new Float32Array(width * height);
  
  for (let i = 0; i < sourceData.length; i += 4) {
    const r = sourceData[i] / 255;
    const g = sourceData[i + 1] / 255;
    const b = sourceData[i + 2] / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    buffer[i / 4] = applyLevels(lum, settings.levelsBlack, settings.levelsWhite, settings.levelsMid, settings.outputLevelsBlack, settings.outputLevelsWhite) * settings.brightnessBoost;
    output[i + 3] = sourceData[i + 3];
  }

  for (let y = 0; y < height; y++) {
    if (onProgress && y % 10 === 0) onProgress(Math.round((y / height) * 100));
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldVal = buffer[idx];
      const newVal = oldVal > 0.5 ? 1.0 : 0.0;
      
      const ink = settings.targetBackground === 'dark' ? newVal * 255 : (1 - newVal) * 255;
      const outIdx = idx * 4;
      output[outIdx] = output[outIdx + 1] = output[outIdx + 2] = ink;
      
      const err = oldVal - newVal;
      
      if (x + 1 < width) buffer[idx + 1] += err * 7 / 16;
      if (y + 1 < height) {
        if (x > 0) buffer[idx + width - 1] += err * 3 / 16;
        buffer[idx + width] += err * 5 / 16;
        if (x + 1 < width) buffer[idx + width + 1] += err * 1 / 16;
      }
    }
  }
  return output;
}

/**
 * Ordered (Bayer) dither.
 */
function processOrderedDither(
  sourceData: Uint8ClampedArray,
  width: number,
  height: number,
  settings: HalftoneSettings,
  onProgress?: ProgressCallback,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(width * height * 4);
  const bayer8x8 = [
    [ 0, 48, 12, 60,  3, 51, 15, 63],
    [32, 16, 44, 28, 35, 19, 47, 31],
    [ 8, 56,  4, 52, 11, 59,  7, 55],
    [40, 24, 36, 20, 43, 27, 39, 23],
    [ 2, 50, 14, 62,  1, 49, 13, 61],
    [34, 18, 46, 30, 33, 17, 45, 29],
    [10, 58,  6, 54,  9, 57,  5, 53],
    [42, 26, 38, 22, 41, 25, 37, 21]
  ];

  for (let y = 0; y < height; y++) {
    if (onProgress && y % 20 === 0) onProgress(Math.round((y / height) * 100));
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const a = sourceData[idx + 3];
      if (a < 10) continue;

      const r = sourceData[idx] / 255;
      const g = sourceData[idx + 1] / 255;
      const b = sourceData[idx + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      
      const adjustedLum = applyLevels(lum, settings.levelsBlack, settings.levelsWhite, settings.levelsMid, settings.outputLevelsBlack, settings.outputLevelsWhite) * settings.brightnessBoost;
      
      const patternX = Math.floor(x / settings.ditherScale) % 8;
      const patternY = Math.floor(y / settings.ditherScale) % 8;
      const threshold = (bayer8x8[patternY][patternX] + 0.5) / 64;
      const value = adjustedLum >= threshold ? 1.0 : 0.0;
      
      const ink = settings.targetBackground === 'dark' ? value * 255 : (1 - value) * 255;
      output[idx] = output[idx + 1] = output[idx + 2] = ink;
      output[idx + 3] = a;
    }
  }
  return output;
}

/**
 * Fallback pixel-based dot drawing when OffscreenCanvas is not available.
 */
function drawDotPixels(
  data: Uint8ClampedArray,
  imgWidth: number,
  imgHeight: number,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number,
  a: number,
  shape: string,
  _angle: number,
): void {
  const x0 = Math.max(0, Math.floor(cx - radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(imgWidth - 1, Math.ceil(cx + radius));
  const y1 = Math.min(imgHeight - 1, Math.ceil(cy + radius));

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      let inside = false;
      const dx = px - cx;
      const dy = py - cy;

      switch (shape) {
        case 'round':
          inside = dx * dx + dy * dy <= radius * radius;
          break;
        case 'square':
          inside = Math.abs(dx) <= radius && Math.abs(dy) <= radius;
          break;
        case 'ellipse':
          inside = (dx * dx) / (radius * radius) + (dy * dy) / ((radius * 0.5) * (radius * 0.5)) <= 1;
          break;
        case 'diamond':
          inside = Math.abs(dx) / radius + Math.abs(dy) / radius <= 1;
          break;
        case 'line':
          inside = Math.abs(dx) <= radius && Math.abs(dy) <= radius * 0.35;
          break;
        default:
          inside = dx * dx + dy * dy <= radius * radius;
      }

      if (inside) {
        const idx = (py * imgWidth + px) * 4;
        const srcA = a / 255;
        const dstA = data[idx + 3] / 255;
        const outA = srcA + dstA * (1 - srcA);

        if (outA > 0) {
          data[idx] = Math.round((r * srcA + data[idx] * dstA * (1 - srcA)) / outA);
          data[idx + 1] = Math.round((g * srcA + data[idx + 1] * dstA * (1 - srcA)) / outA);
          data[idx + 2] = Math.round((b * srcA + data[idx + 2] * dstA * (1 - srcA)) / outA);
          data[idx + 3] = Math.round(outA * 255);
        }
      }
    }
  }
}
