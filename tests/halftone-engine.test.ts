/**
 * Unit tests for halftone engine utilities.
 */
import { describe, it, expect } from 'vitest';
import { luminance, averageColor, isNearBlack } from '../src/utils/color';

describe('luminance', () => {
  it('returns 0 for pure black', () => {
    expect(luminance(0, 0, 0)).toBe(0);
  });

  it('returns 1 for pure white', () => {
    expect(luminance(1, 1, 1)).toBeCloseTo(1, 4);
  });

  it('returns correct value for pure red', () => {
    expect(luminance(1, 0, 0)).toBeCloseTo(0.2126, 4);
  });

  it('returns correct value for pure green', () => {
    expect(luminance(0, 1, 0)).toBeCloseTo(0.7152, 4);
  });

  it('returns correct value for pure blue', () => {
    expect(luminance(0, 0, 1)).toBeCloseTo(0.0722, 4);
  });

  it('returns higher luminance for green than red or blue', () => {
    const lR = luminance(1, 0, 0);
    const lG = luminance(0, 1, 0);
    const lB = luminance(0, 0, 1);
    expect(lG).toBeGreaterThan(lR);
    expect(lG).toBeGreaterThan(lB);
  });
});

describe('averageColor', () => {
  it('returns correct values for uniform red image', () => {
    // 2x2 image, all red (255, 0, 0, 255)
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,
      255, 0, 0, 255,
      255, 0, 0, 255,
      255, 0, 0, 255,
    ]);
    const avg = averageColor(data, 2, 2, 0, 0, 2, 2);
    expect(avg.r).toBe(255);
    expect(avg.g).toBe(0);
    expect(avg.b).toBe(0);
    expect(avg.a).toBe(255);
  });

  it('returns correct average for mixed colors', () => {
    // 2x1 image: red and blue
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 0, 255, 255,
    ]);
    const avg = averageColor(data, 2, 1, 0, 0, 2, 1);
    expect(avg.r).toBeCloseTo(127.5, 0);
    expect(avg.b).toBeCloseTo(127.5, 0);
  });

  it('handles out-of-bounds region gracefully', () => {
    const data = new Uint8ClampedArray([255, 128, 64, 255]);
    const avg = averageColor(data, 1, 1, -10, -10, 1, 1);
    // Should clamp to valid region and return zeros (no valid pixels)
    expect(avg.r).toBe(0);
  });

  it('handles empty region', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    const avg = averageColor(data, 1, 1, 5, 5, 1, 1);
    expect(avg.r).toBe(0);
    expect(avg.lum).toBe(0);
  });
});

describe('isNearBlack', () => {
  it('returns true for pure black', () => {
    expect(isNearBlack(0, 0, 0, 0.15)).toBe(true);
  });

  it('returns true for very dark gray', () => {
    expect(isNearBlack(20, 20, 20, 0.15)).toBe(true);
  });

  it('returns false for white', () => {
    expect(isNearBlack(255, 255, 255, 0.15)).toBe(false);
  });

  it('returns false for mid-gray', () => {
    expect(isNearBlack(128, 128, 128, 0.15)).toBe(false);
  });

  it('respects threshold parameter', () => {
    // With a very high threshold, even mid-gray is "near black"
    expect(isNearBlack(128, 128, 128, 0.99)).toBe(true);
  });
});
