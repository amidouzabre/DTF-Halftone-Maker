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
import { averageColor, isNearBlack } from './color';
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
export function processHalftone(
  sourceData: Uint8ClampedArray,
  width: number,
  height: number,
  settings: HalftoneSettings,
  onProgress?: ProgressCallback,
): Uint8ClampedArray {
  // Determine effective settings (manual override or computed)
  const effectiveGridSize = settings.useManualValues
    ? settings.manualValues.size
    : settings.gridSize;
  const effectiveDensity = settings.useManualValues
    ? settings.manualValues.density
    : settings.density;
  const effectiveThreshold = settings.useManualValues
    ? settings.manualValues.threshold
    : settings.threshold;
  const gridSize = Math.max(2, effectiveGridSize);
  const angleRad = (settings.angle * Math.PI) / 180;
  const maxRadius = settings.maxDotRadius;
  const density = effectiveDensity;
  const threshold = effectiveThreshold;

  // Try to use OffscreenCanvas for drawing, fall back to pixel manipulation
  let useCanvas = false;
  let canvas: OffscreenCanvas | null = null;
  let ctx: OffscreenCanvasRenderingContext2D | null = null;

  try {
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d');
    if (ctx) {
      useCanvas = true;
      // Clear to transparent
      ctx.clearRect(0, 0, width, height);
    }
  } catch {
    // OffscreenCanvas not available, use manual pixel approach
  }

  // Output pixel data (transparent by default)
  const outputData = new Uint8ClampedArray(width * height * 4);

  // Calculate grid bounds - we need to cover the entire image even when rotated
  const cos = Math.cos(-angleRad);
  const sin = Math.sin(-angleRad);
  const cosPos = Math.cos(angleRad);
  const sinPos = Math.sin(angleRad);

  // Calculate how many grid cells we need to cover the rotated image
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  // Transform corners to grid space
  let minGx = Infinity, maxGx = -Infinity;
  let minGy = Infinity, maxGy = -Infinity;

  for (const corner of corners) {
    const gx = corner.x * cos - corner.y * sin;
    const gy = corner.x * sin + corner.y * cos;
    minGx = Math.min(minGx, gx);
    maxGx = Math.max(maxGx, gx);
    minGy = Math.min(minGy, gy);
    maxGy = Math.max(maxGy, gy);
  }

  // Grid cell iteration range
  const startCol = Math.floor(minGx / gridSize) - 1;
  const endCol = Math.ceil(maxGx / gridSize) + 1;
  const startRow = Math.floor(minGy / gridSize) - 1;
  const endRow = Math.ceil(maxGy / gridSize) + 1;

  const totalRows = endRow - startRow;
  const dotDrawer = getDotDrawer(settings.dotShape);

  // Process grid cells
  for (let row = startRow; row <= endRow; row++) {
    // Report progress
    if (onProgress && (row - startRow) % 4 === 0) {
      const progress = Math.min(100, Math.round(((row - startRow) / totalRows) * 100));
      onProgress(progress);
    }

    for (let col = startCol; col <= endCol; col++) {
      // Grid cell center in grid space
      const gcx = (col + 0.5) * gridSize;
      const gcy = (row + 0.5) * gridSize;

      // Transform back to image space
      const imgX = gcx * cosPos - gcy * sinPos;
      const imgY = gcx * sinPos + gcy * cosPos;

      // Skip if center is outside image bounds (with margin)
      if (
        imgX < -gridSize || imgX >= width + gridSize ||
        imgY < -gridSize || imgY >= height + gridSize
      ) {
        continue;
      }

      // Sample the source image in this cell's area
      const sampleX = imgX - gridSize / 2;
      const sampleY = imgY - gridSize / 2;
      const avg = averageColor(
        sourceData,
        width,
        height,
        sampleX,
        sampleY,
        gridSize,
        gridSize,
      );

      // Skip transparent areas
      if (avg.a < 10) continue;

      // Calculate dot size based on darkness (1 - luminance = darkness)
      const darkness = 1 - avg.lum;

      // Apply threshold - skip dots in light areas
      if (darkness < (1 - threshold)) continue;

      // Calculate radius proportional to darkness
      let dotRadius = maxRadius * darkness * density;

      // Clamp to reasonable bounds
      dotRadius = Math.max(0.5, Math.min(dotRadius, maxRadius));

      // Handle "make black transparent" option
      if (settings.makeBlackTransparent && isNearBlack(avg.r, avg.g, avg.b, settings.blackThreshold)) {
        continue; // Skip this dot entirely (leave transparent)
      }

      // Determine dot color
      const dotR = settings.preserveColor ? Math.round(avg.r) : 0;
      const dotG = settings.preserveColor ? Math.round(avg.g) : 0;
      const dotB = settings.preserveColor ? Math.round(avg.b) : 0;
      const dotA = Math.round(avg.a);

      if (useCanvas && ctx) {
        // Draw using Canvas API (better quality with anti-aliasing)
        ctx.fillStyle = `rgba(${dotR}, ${dotG}, ${dotB}, ${dotA / 255})`;
        dotDrawer(ctx, imgX, imgY, dotRadius, angleRad);
      } else {
        // Fallback: draw manually into pixel array
        drawDotPixels(
          outputData,
          width,
          height,
          imgX,
          imgY,
          dotRadius,
          dotR,
          dotG,
          dotB,
          dotA,
          settings.dotShape,
          angleRad,
        );
      }
    }
  }

  if (useCanvas && ctx && canvas) {
    // Extract pixel data from canvas
    const result = ctx.getImageData(0, 0, width, height);
    return result.data;
  }

  return outputData;
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
        // Alpha compositing (over operator)
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
