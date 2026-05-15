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
  
  // Default Halftone logic
  const effectiveGridSize = settings.useManualValues ? settings.manualValues.size : settings.gridSize;
  const effectiveDensity = settings.useManualValues ? settings.manualValues.density : settings.density;
  const effectiveThreshold = settings.useManualValues ? settings.manualValues.threshold : settings.threshold;
  const gridSize = Math.max(1, effectiveGridSize);
  const angleRad = (settings.angle * Math.PI) / 180;
  const maxRadius = settings.maxDotRadius;
  const density = effectiveDensity;
  const threshold = effectiveThreshold;

  let useCanvas = false;
  let canvas: OffscreenCanvas | null = null;
  let ctx: OffscreenCanvasRenderingContext2D | null = null;

  try {
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d');
    if (ctx) {
      useCanvas = true;
      ctx.clearRect(0, 0, width, height);
    }
  } catch {}

  const outputData = new Uint8ClampedArray(width * height * 4);
  const cos = Math.cos(-angleRad);
  const sin = Math.sin(-angleRad);
  const cosPos = Math.cos(angleRad);
  const sinPos = Math.sin(angleRad);

  const corners = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  let minGx = Infinity, maxGx = -Infinity, minGy = Infinity, maxGy = -Infinity;
  for (const corner of corners) {
    const gx = corner.x * cos - corner.y * sin;
    const gy = corner.x * sin + corner.y * cos;
    minGx = Math.min(minGx, gx); maxGx = Math.max(maxGx, gx);
    minGy = Math.min(minGy, gy); maxGy = Math.max(maxGy, gy);
  }

  const startCol = Math.floor(minGx / gridSize) - 1;
  const endCol = Math.ceil(maxGx / gridSize) + 1;
  const startRow = Math.floor(minGy / gridSize) - 1;
  const endRow = Math.ceil(maxGy / gridSize) + 1;
  const totalRows = endRow - startRow;
  const dotDrawer = getDotDrawer(settings.dotShape);

  for (let row = startRow; row <= endRow; row++) {
    if (onProgress && (row - startRow) % 4 === 0) {
      onProgress(Math.min(100, Math.round(((row - startRow) / totalRows) * 100)));
    }
    for (let col = startCol; col <= endCol; col++) {
      const gcx = (col + 0.5) * gridSize;
      const gcy = (row + 0.5) * gridSize;
      const imgX = gcx * cosPos - gcy * sinPos;
      const imgY = gcx * sinPos + gcy * cosPos;

      if (imgX < -gridSize || imgX >= width + gridSize || imgY < -gridSize || imgY >= height + gridSize) continue;

      const avg = averageColor(sourceData, width, height, imgX - gridSize / 2, imgY - gridSize / 2, gridSize, gridSize);
      if (avg.a < 10) continue;

      const adjustedLum = applyLevels(avg.lum, settings.levelsBlack, settings.levelsWhite, settings.levelsMid, settings.outputLevelsBlack, settings.outputLevelsWhite);
      const rawIntensity = settings.targetBackground === 'dark' ? adjustedLum : 1 - adjustedLum;
      const intensity = Math.min(1, rawIntensity * settings.brightnessBoost);
      
      if (intensity < (1 - threshold)) continue;

      let dotRadius = maxRadius * Math.sqrt(intensity) * density;
      dotRadius = Math.max(0.5, Math.min(dotRadius, maxRadius));

      if (settings.makeBlackTransparent && isNearBlack(avg.r, avg.g, avg.b, settings.blackThreshold)) continue;
      if (settings.makeWhiteTransparent && isNearWhite(avg.r, avg.g, avg.b, settings.whiteThreshold)) continue;

      const defaultInk = settings.targetBackground === 'dark' ? 255 : 0;
      const dotR = settings.preserveColor ? Math.round(applyLevels(avg.vR / 255, settings.levelsBlack, settings.levelsWhite, settings.levelsMid, settings.outputLevelsBlack, settings.outputLevelsWhite) * 255) : defaultInk;
      const dotG = settings.preserveColor ? Math.round(applyLevels(avg.vG / 255, settings.levelsBlack, settings.levelsWhite, settings.levelsMid, settings.outputLevelsBlack, settings.outputLevelsWhite) * 255) : defaultInk;
      const dotB = settings.preserveColor ? Math.round(applyLevels(avg.vB / 255, settings.levelsBlack, settings.levelsWhite, settings.levelsMid, settings.outputLevelsBlack, settings.outputLevelsWhite) * 255) : defaultInk;
      const dotA = Math.round(avg.a);

      if (useCanvas && ctx) {
        ctx.fillStyle = `rgba(${dotR}, ${dotG}, ${dotB}, ${dotA / 255})`;
        dotDrawer(ctx, imgX, imgY, dotRadius, angleRad);
      } else {
        drawDotPixels(outputData, width, height, imgX, imgY, dotRadius, dotR, dotG, dotB, dotA, settings.dotShape, angleRad);
      }
    }
  }

  if (useCanvas && ctx && canvas) {
    return ctx.getImageData(0, 0, width, height).data;
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
