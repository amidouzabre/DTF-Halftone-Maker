/**
 * Image loading composable.
 * Handles file loading, CORS, and auto-resize for large images.
 */

import { ref } from 'vue';
import type { ImageInfo } from '../types/halftone';

export function useImageLoader() {
  const imageInfo = ref<ImageInfo | null>(null);
  const imageData = ref<ImageData | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const thumbnailUrl = ref<string | null>(null);

  /**
   * Load an image from a File object.
   * Automatically resizes if dimensions exceed maxResolution.
   */
  async function loadImage(
    file: File,
    maxResolution: number = 2500,
    autoResize: boolean = true,
  ): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const img = await createImageFromFile(file);

      let displayWidth = img.width;
      let displayHeight = img.height;

      // Auto-resize if needed
      if (autoResize && (img.width > maxResolution || img.height > maxResolution)) {
        const scale = maxResolution / Math.max(img.width, img.height);
        displayWidth = Math.round(img.width * scale);
        displayHeight = Math.round(img.height * scale);
      }

      // Draw image to canvas to extract pixel data
      const canvas = document.createElement('canvas');
      canvas.width = displayWidth;
      canvas.height = displayHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not create canvas context');
      }

      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

      // Extract pixel data
      imageData.value = ctx.getImageData(0, 0, displayWidth, displayHeight);

      // Create thumbnail for preview
      thumbnailUrl.value = canvas.toDataURL('image/png');

      // Store metadata
      imageInfo.value = {
        originalWidth: img.width,
        originalHeight: img.height,
        displayWidth,
        displayHeight,
        fileSize: file.size,
        fileName: file.name,
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load image';
      imageData.value = null;
      imageInfo.value = null;
      thumbnailUrl.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Create an HTMLImageElement from a File.
   */
  function createImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to decode image. File may be corrupted or unsupported.'));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Format file size to human-readable string.
   */
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Clear loaded image.
   */
  function clearImage(): void {
    imageData.value = null;
    imageInfo.value = null;
    thumbnailUrl.value = null;
    error.value = null;
  }

  return {
    imageInfo,
    imageData,
    isLoading,
    error,
    thumbnailUrl,
    loadImage,
    clearImage,
    formatFileSize,
  };
}
