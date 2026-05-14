<script setup lang="ts">
/**
 * Image uploader component with drag & drop support.
 * Displays metadata about the loaded image.
 */
import { ref } from 'vue';
import type { ImageInfo } from '../types/halftone';

const props = defineProps<{
  imageInfo: ImageInfo | null;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'file-selected', file: File): void;
}>();

const isDragging = ref(false);

function onDragOver(event: DragEvent) {
  event.preventDefault();
  isDragging.value = true;
}

function onDragLeave() {
  isDragging.value = false;
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (file.type.startsWith('image/')) {
      emit('file-selected', file);
    }
  }
}

function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    emit('file-selected', file);
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<template>
  <div class="uploader-section">
    <!-- Drop zone -->
    <div
      v-if="!imageInfo"
      class="drop-zone"
      :class="{ 'drop-zone--active': isDragging, 'drop-zone--loading': isLoading }"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <div class="drop-zone__content">
        <svg class="drop-zone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <p class="drop-zone__text" v-if="!isLoading">
          Glissez une image ici
        </p>
        <p class="drop-zone__text" v-else>
          Chargement...
        </p>
        <p class="drop-zone__subtext" v-if="!isLoading">ou</p>
        <label v-if="!isLoading" class="drop-zone__button">
          Parcourir
          <input
            type="file"
            accept="image/*"
            class="sr-only"
            @change="onFileInput"
          />
        </label>
      </div>
    </div>

    <!-- Image metadata -->
    <div v-else class="image-meta">
      <div class="image-meta__header">
        <svg class="image-meta__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="image-meta__filename">{{ imageInfo.fileName }}</span>
      </div>
      <div class="image-meta__details">
        <div class="image-meta__item">
          <span class="image-meta__label">Original</span>
          <span class="image-meta__value">{{ imageInfo.originalWidth }} × {{ imageInfo.originalHeight }}</span>
        </div>
        <div class="image-meta__item" v-if="imageInfo.displayWidth !== imageInfo.originalWidth">
          <span class="image-meta__label">Redimensionné</span>
          <span class="image-meta__value">{{ imageInfo.displayWidth }} × {{ imageInfo.displayHeight }}</span>
        </div>
        <div class="image-meta__item">
          <span class="image-meta__label">Taille</span>
          <span class="image-meta__value">{{ formatSize(imageInfo.fileSize) }}</span>
        </div>
      </div>
      <label class="drop-zone__button drop-zone__button--small">
        Changer l'image
        <input
          type="file"
          accept="image/*"
          class="sr-only"
          @change="onFileInput"
        />
      </label>
    </div>
  </div>
</template>
