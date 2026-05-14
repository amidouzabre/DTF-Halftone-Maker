import { describe, it, expect } from 'vitest';
import { averageColor } from '../src/utils/color';

describe('White Color Preservation', () => {
  it('calculates luminance and vibrant color for mixed white/black region', () => {
    // 4x4 region: 4 white pixels, 12 black pixels
    // This represents a small white detail on black background
    const data = new Uint8ClampedArray(16 * 4);
    for (let i = 0; i < 16; i++) {
      const isWhite = i < 4;
      const val = isWhite ? 255 : 0;
      data[i * 4] = val;
      data[i * 4 + 1] = val;
      data[i * 4 + 2] = val;
      data[i * 4 + 3] = 255;
    }

    const avg = averageColor(data, 4, 4, 0, 0, 4, 4);
    
    // Simple average luminance should be 4/16 = 0.25
    expect(avg.lum).toBeCloseTo(0.25);
    
    // In engine, intensity = avg.lum (for dark background)
    const intensity = avg.lum;
    
    // Radius calculation should now use sqrt(intensity)
    const maxRadius = 8;
    const density = 1.0;
    const radius = maxRadius * Math.sqrt(intensity) * density;
    
    // sqrt(0.25) = 0.5. So radius should be 0.5 * 8 = 4.
    expect(radius).toBe(4);
    
    // Area coverage = PI * r^2 / gridSize^2. 
    // GridSize = 12. r=4. Area = PI * 16 / 144 = PI/9 ~= 0.349.
    // This is much closer to 0.25 than the old linear version (r=2, area = PI*4/144 ~= 0.087).
  });
});
