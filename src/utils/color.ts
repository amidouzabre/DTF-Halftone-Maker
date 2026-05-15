/**
 * Color and luminance utility functions for halftone processing.
 */

/**
 * Calculate perceived luminance from RGB values (0–1 range).
 * Uses ITU-R BT.709 coefficients.
 */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate the average color and luminance of a rectangular region in image data.
 */
export function averageColor(
  data: Uint8ClampedArray,
  imgWidth: number,
  imgHeight: number,
  regionX: number,
  regionY: number,
  regionW: number,
  regionH: number,
): { r: number; g: number; b: number; a: number; lum: number; vR: number; vG: number; vB: number } {
  let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
  let fgR = 0, fgG = 0, fgB = 0, fgCount = 0;
  let count = 0;

  const x0 = Math.max(0, Math.floor(regionX));
  const y0 = Math.max(0, Math.floor(regionY));
  const x1 = Math.min(imgWidth, Math.ceil(regionX + regionW));
  const y1 = Math.min(imgHeight, Math.ceil(regionY + regionH));

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * imgWidth + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      
      totalR += r;
      totalG += g;
      totalB += b;
      totalA += a;
      count++;

      // Vibrant color sampling: ignore black or transparent pixels
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (a > 20 && l > 0.01) {
        fgR += r;
        fgG += g;
        fgB += b;
        fgCount++;
      }
    }
  }

  if (count === 0) {
    return { r: 0, g: 0, b: 0, a: 0, lum: 0, vR: 0, vG: 0, vB: 0 };
  }

  const r = totalR / count;
  const g = totalG / count;
  const b = totalB / count;
  const a = totalA / count;
  const lum = luminance(r / 255, g / 255, b / 255);

  // If no foreground pixels found, fallback to simple average
  const vR = fgCount > 0 ? fgR / fgCount : r;
  const vG = fgCount > 0 ? fgG / fgCount : g;
  const vB = fgCount > 0 ? fgB / fgCount : b;

  return { r, g, b, a, lum, vR, vG, vB };
}

/**
 * Determine if a color is near-black based on a luminance threshold.
 */
export function isNearBlack(r: number, g: number, b: number, threshold: number): boolean {
  return luminance(r / 255, g / 255, b / 255) < threshold;
}

/**
 * Determine if a color is near-white based on a luminance threshold.
 */
export function isNearWhite(r: number, g: number, b: number, threshold: number): boolean {
  return luminance(r / 255, g / 255, b / 255) > threshold;
}
