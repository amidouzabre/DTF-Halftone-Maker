/**
 * Dot shape drawing functions for halftone rendering.
 * Each function draws a single dot at (cx, cy) with given size and rotation angle.
 * 
 * To add a new shape:
 * 1. Create a new draw function following the same signature
 * 2. Add it to the `dotShapeDrawers` map
 * 3. Add the shape name to the DotShape type in types/halftone.ts
 */

import type { DotShape } from '../types/halftone';

export type DotDrawer = (
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  angle: number,
) => void;

/**
 * Draw a circular dot.
 */
function drawRound(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  _angle: number,
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw a square dot (rotated by the grid angle).
 */
function drawSquare(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillRect(-size, -size, size * 2, size * 2);
  ctx.restore();
}

/**
 * Draw an elliptical dot (2:1 aspect ratio, rotated).
 */
function drawEllipse(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a diamond (rhombus) dot.
 */
function drawDiamond(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a line dot (thin rectangle, rotated).
 */
function drawLine(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const lineWidth = size * 0.35;
  ctx.fillRect(-size, -lineWidth, size * 2, lineWidth * 2);
  ctx.restore();
}

/**
 * Map of dot shape names to their drawing functions.
 */
export const dotShapeDrawers: Record<DotShape, DotDrawer> = {
  round: drawRound,
  square: drawSquare,
  ellipse: drawEllipse,
  diamond: drawDiamond,
  line: drawLine,
};

/**
 * Get the drawing function for a given dot shape.
 */
export function getDotDrawer(shape: DotShape): DotDrawer {
  return dotShapeDrawers[shape] || drawRound;
}
