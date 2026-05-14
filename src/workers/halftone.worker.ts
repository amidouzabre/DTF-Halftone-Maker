/// <reference lib="webworker" />
/**
 * Halftone Web Worker.
 * 
 * Receives image data and settings from the main thread,
 * processes the halftone transformation, and sends back
 * progress updates and the final result.
 */

import type { WorkerMessage, WorkerResponse } from '../types/halftone';
import { processHalftone } from '../utils/halftone-engine';

const ctx: DedicatedWorkerGlobalScope = self as any;

ctx.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, imageData, width, height, settings } = event.data;

  if (type !== 'process') return;

  try {
    // Convert ArrayBuffer back to Uint8ClampedArray
    const sourceData = new Uint8ClampedArray(imageData);

    // Process with progress reporting
    const resultData = processHalftone(
      sourceData,
      width,
      height,
      settings,
      (progress: number) => {
        const response: WorkerResponse = {
          type: 'progress',
          progress,
        };
        ctx.postMessage(response);
      },
    );

    // Send back the result as a transferable ArrayBuffer
    const resultBuffer = resultData.buffer;

    const response: WorkerResponse = {
      type: 'complete',
      imageData: resultBuffer as ArrayBuffer,
      width,
      height,
    };

    ctx.postMessage(response, [resultBuffer] as Transferable[]);
  } catch (error) {
    const response: WorkerResponse = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown processing error',
    };
    ctx.postMessage(response);
  }
};
