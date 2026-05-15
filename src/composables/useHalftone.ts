/**
 * Main halftone processing orchestrator composable.
 * 
 * Manages the connection between UI settings, the Web Worker,
 * and the output canvas. Provides debounced processing for
 * real-time preview.
 */

import { ref, reactive, watch, onUnmounted } from 'vue';
import type { HalftoneSettings, WorkerMessage, WorkerResponse } from '../types/halftone';
import { DEFAULT_SETTINGS } from '../types/halftone';
import { useHistory } from './useHistory';
import { useImageLoader } from './useImageLoader';
import { applyLevels } from '../utils/halftone-engine';

export function useHalftone() {
  // Settings
  const settings = reactive<HalftoneSettings>({ ...DEFAULT_SETTINGS });

  // Image handling
  const imageLoader = useImageLoader();

  // History
  const history = useHistory();

  // Processing state
  const isProcessing = ref(false);
  const progress = ref(0);
  const resultImageData = ref<ImageData | null>(null);
  const resultDataUrl = ref<string | null>(null);

  // Worker
  let worker: Worker | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Initialize the Web Worker.
   */
  function initWorker(): void {
    if (worker) return;

    worker = new Worker(
      new URL('../workers/halftone.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;

      switch (response.type) {
        case 'progress':
          progress.value = response.progress ?? 0;
          break;

        case 'complete':
          if (response.imageData && response.width && response.height) {
            const data = new Uint8ClampedArray(response.imageData);
            resultImageData.value = new ImageData(new Uint8ClampedArray(data.buffer as ArrayBuffer), response.width, response.height);
            renderResultToDataUrl(response.width, response.height, data);
          }
          isProcessing.value = false;
          progress.value = 100;
          break;

        case 'error':
          console.error('Worker error:', response.error);
          isProcessing.value = false;
          progress.value = 0;
          break;
      }
    };

    worker.onerror = (err) => {
      console.error('Worker crashed:', err);
      isProcessing.value = false;
      progress.value = 0;
    };
  }

  /**
   * Render result pixel data to a data URL for display and export.
   */
  function renderResultToDataUrl(
    width: number,
    height: number,
    data: Uint8ClampedArray,
  ): void {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = new ImageData(new Uint8ClampedArray(data.buffer as ArrayBuffer), width, height);
    ctx.putImageData(imgData, 0, 0);
    resultDataUrl.value = canvas.toDataURL('image/png');
  }

  /**
   * Send image data to the worker for processing.
   */
  function processImage(): void {
    if (!imageLoader.imageData.value) return;

    initWorker();
    if (!worker) return;

    isProcessing.value = true;
    progress.value = 0;

    const imgData = imageLoader.imageData.value;
    const buffer = imgData.data.buffer.slice(0);

    const message: WorkerMessage = {
      type: 'process',
      imageData: buffer,
      width: imgData.width,
      height: imgData.height,
      settings: JSON.parse(JSON.stringify(settings)),
    };

    worker.postMessage(message, [buffer]);
  }

  /**
   * Process with debounce for real-time preview.
   */
  function processDebounced(delay = 300): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      processImage();
    }, delay);
  }

  /**
   * Update settings and trigger reprocessing.
   */
  function updateSettings(partial: Partial<HalftoneSettings>): void {
    // Save current state to history before changing
    history.push({ ...settings });

    // Auto-adjust targetBackground if supportColor is changed
    if (partial.supportColor !== undefined) {
      const hex = partial.supportColor;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      
      // If the user didn't explicitly change targetBackground in this update,
      // suggest the best one based on support color luminance.
      if (partial.targetBackground === undefined) {
        partial.targetBackground = lum < 0.5 ? 'dark' : 'light';
      }
    }

    Object.assign(settings, partial);

    if (imageLoader.imageData.value) {
      processDebounced();
    }
  }

  /**
   * Undo the last settings change.
   */
  function undo(): void {
    const previous = history.undo({ ...settings });
    if (previous) {
      Object.assign(settings, previous);
      if (imageLoader.imageData.value) {
        processDebounced(100);
      }
    }
  }

  /**
   * Redo the last undone settings change.
   */
  function redo(): void {
    const next = history.redo({ ...settings });
    if (next) {
      Object.assign(settings, next);
      if (imageLoader.imageData.value) {
        processDebounced(100);
      }
    }
  }

  /**
   * Reset all settings to defaults.
   */
  function resetSettings(): void {
    history.push({ ...settings });
    Object.assign(settings, { ...DEFAULT_SETTINGS });
    if (imageLoader.imageData.value) {
      processDebounced(100);
    }
  }

  /**
   * Export the current result as a PNG file download.
   */
  function exportPNG(): void {
    if (!resultImageData.value) return;

    const canvas = document.createElement('canvas');
    canvas.width = resultImageData.value.width;
    canvas.height = resultImageData.value.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.putImageData(resultImageData.value, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;

      const fileName = imageLoader.imageInfo.value?.fileName || 'image';
      const baseName = fileName.replace(/\.[^.]+$/, '');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${baseName}_halftone.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  }

  /**
   * Export the current result as an approximate SVG.
   */
  function exportSVG(): void {
    if (!imageLoader.imageData.value) return;

    const imgData = imageLoader.imageData.value;
    const width = imgData.width;
    const height = imgData.height;
    const sourceData = imgData.data;

    const gridSize = settings.useManualValues ? settings.manualValues.size : settings.gridSize;
    const maxRadius = settings.maxDotRadius;
    const density = settings.useManualValues ? settings.manualValues.density : settings.density;
    const threshold = settings.useManualValues ? settings.manualValues.threshold : settings.threshold;


    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;

    // Simple grid iteration (no rotation for SVG simplicity)
    for (let y = 0; y < height; y += gridSize) {
      for (let x = 0; x < width; x += gridSize) {
        // Sample average color
        let totalR = 0, totalG = 0, totalB = 0, count = 0;
        for (let sy = y; sy < Math.min(y + gridSize, height); sy++) {
          for (let sx = x; sx < Math.min(x + gridSize, width); sx++) {
            const idx = (sy * width + sx) * 4;
            totalR += sourceData[idx];
            totalG += sourceData[idx + 1];
            totalB += sourceData[idx + 2];
            count++;
          }
        }

        const r = Math.round(totalR / count);
        const g = Math.round(totalG / count);
        const b = Math.round(totalB / count);
        const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
        
        const adjustedLum = applyLevels(lum, settings.levelsBlack, settings.levelsWhite, settings.levelsMid, settings.outputLevelsBlack, settings.outputLevelsWhite);
        const rawIntensity = settings.targetBackground === 'dark' ? adjustedLum : 1 - adjustedLum;
        const intensity = Math.min(1, rawIntensity * settings.brightnessBoost);

        if (intensity < (1 - threshold)) continue;

        const dotRadius = maxRadius * Math.sqrt(intensity) * density;
        const cx = x + gridSize / 2;
        const cy_pos = y + gridSize / 2;
        
        let color = '#000';
        if (settings.preserveColor) {
          const adjR = Math.round(applyLevels(r / 255, settings.levelsBlack, settings.levelsWhite, settings.levelsMid, settings.outputLevelsBlack, settings.outputLevelsWhite) * 255);
          const adjG = Math.round(applyLevels(g / 255, settings.levelsBlack, settings.levelsWhite, settings.levelsMid, settings.outputLevelsBlack, settings.outputLevelsWhite) * 255);
          const adjB = Math.round(applyLevels(b / 255, settings.levelsBlack, settings.levelsWhite, settings.levelsMid, settings.outputLevelsBlack, settings.outputLevelsWhite) * 255);
          color = `rgb(${adjR},${adjG},${adjB})`;
        } else {
          color = settings.targetBackground === 'dark' ? '#fff' : '#000';
        }

        switch (settings.dotShape) {
          case 'round':
            svgContent += `  <circle cx="${cx}" cy="${cy_pos}" r="${dotRadius.toFixed(1)}" fill="${color}" transform="rotate(${settings.angle} ${cx} ${cy_pos})"/>\n`;
            break;
          case 'square':
            svgContent += `  <rect x="${(cx - dotRadius).toFixed(1)}" y="${(cy_pos - dotRadius).toFixed(1)}" width="${(dotRadius * 2).toFixed(1)}" height="${(dotRadius * 2).toFixed(1)}" fill="${color}" transform="rotate(${settings.angle} ${cx} ${cy_pos})"/>\n`;
            break;
          case 'ellipse':
            svgContent += `  <ellipse cx="${cx}" cy="${cy_pos}" rx="${dotRadius.toFixed(1)}" ry="${(dotRadius * 0.5).toFixed(1)}" fill="${color}" transform="rotate(${settings.angle} ${cx} ${cy_pos})"/>\n`;
            break;
          case 'diamond':
            svgContent += `  <polygon points="${cx},${cy_pos - dotRadius} ${cx + dotRadius},${cy_pos} ${cx},${cy_pos + dotRadius} ${cx - dotRadius},${cy_pos}" fill="${color}" transform="rotate(${settings.angle} ${cx} ${cy_pos})"/>\n`;
            break;
          case 'line':
            const lw = dotRadius * 0.35;
            svgContent += `  <rect x="${(cx - dotRadius).toFixed(1)}" y="${(cy_pos - lw).toFixed(1)}" width="${(dotRadius * 2).toFixed(1)}" height="${(lw * 2).toFixed(1)}" fill="${color}" transform="rotate(${settings.angle} ${cx} ${cy_pos})"/>\n`;
            break;
        }
      }
    }

    svgContent += '</svg>';

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const fileName = imageLoader.imageInfo.value?.fileName || 'image';
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${baseName}_halftone.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /**
   * Load an image file and start processing.
   */
  async function loadAndProcess(
    file: File,
  ): Promise<void> {
    await imageLoader.loadImage(file, settings.maxResolution, settings.autoResize);
    if (imageLoader.imageData.value) {
      processImage();
    }
  }

  /**
   * Watch for settings changes for auto-preview.
   */
  watch(
    () => ({ ...settings }),
    () => {
      // Auto-process handled by updateSettings
    },
    { deep: true },
  );

  // Cleanup
  onUnmounted(() => {
    if (worker) {
      worker.terminate();
      worker = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });

  return {
    // Settings
    settings,
    updateSettings,
    resetSettings,

    // Image
    ...imageLoader,
    loadAndProcess,

    // Processing
    isProcessing,
    progress,
    resultImageData,
    resultDataUrl,
    processImage,

    // History
    undo,
    redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,

    // Export
    exportPNG,
    exportSVG,
  };
}
