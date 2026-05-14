<script setup lang="ts">
/**
 * Export buttons for PNG and SVG download.
 */
defineProps<{
  hasResult: boolean;
  isProcessing: boolean;
}>();

const emit = defineEmits<{
  (e: 'export-png'): void;
  (e: 'export-svg'): void;
}>();
</script>

<template>
  <div class="export-buttons">
    <button
      class="export-btn export-btn--primary"
      :disabled="!hasResult || isProcessing"
      @click="emit('export-png')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="export-btn__icon">
        <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      Exporter PNG
    </button>
    <button
      class="export-btn export-btn--secondary"
      :disabled="!hasResult || isProcessing"
      @click="emit('export-svg')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="export-btn__icon">
        <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      Exporter SVG
    </button>
  </div>
</template>
