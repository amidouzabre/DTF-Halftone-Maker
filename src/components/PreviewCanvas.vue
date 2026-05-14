<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  resultDataUrl: string | null;
  thumbnailUrl: string | null;
  isProcessing: boolean;
  progress: number;
  hasImage: boolean;
  supportColor: string;
  showCheckerboard: boolean;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);
const isPanning = ref(false);
let lastMouse = { x: 0, y: 0 };

function zoomIn() { zoom.value = Math.min(zoom.value * 1.25, 5); }
function zoomOut() { zoom.value = Math.max(zoom.value / 1.25, 0.1); }
function zoomFit() { zoom.value = 1; panX.value = 0; panY.value = 0; }

function onMouseDown(e: MouseEvent) {
  if (zoom.value > 1) {
    isPanning.value = true;
    lastMouse = { x: e.clientX, y: e.clientY };
  }
}
function onMouseMove(e: MouseEvent) {
  if (!isPanning.value) return;
  panX.value += e.clientX - lastMouse.x;
  panY.value += e.clientY - lastMouse.y;
  lastMouse = { x: e.clientX, y: e.clientY };
}
function onMouseUp() { isPanning.value = false; }

watch(() => props.resultDataUrl, (url) => {
  if (!url || !canvasRef.value) return;
  const ctx = canvasRef.value.getContext('2d');
  if (!ctx) return;
  const img = new Image();
  img.onload = () => {
    canvasRef.value!.width = img.width;
    canvasRef.value!.height = img.height;
    ctx.clearRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
  };
  img.src = url;
});
</script>

<template>
  <div class="preview-area">
    <div v-if="!hasImage" class="preview-empty">
      <svg class="preview-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <p>Importez une image pour commencer</p>
    </div>

    <template v-else>
      <!-- Zoom controls -->
      <div class="zoom-controls">
        <button class="zoom-btn" @click="zoomOut" title="Zoom -">−</button>
        <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
        <button class="zoom-btn" @click="zoomIn" title="Zoom +">+</button>
        <button class="zoom-btn" @click="zoomFit" title="Ajuster">⊡</button>
      </div>

      <!-- Progress bar -->
      <div v-if="isProcessing" class="progress-overlay">
        <div class="progress-bar">
          <div class="progress-bar__fill" :style="{ width: progress + '%' }"></div>
        </div>
        <span class="progress-label">Traitement {{ progress }}%</span>
      </div>

      <!-- Canvas with checkerboard -->
      <div
        class="preview-canvas-wrapper"
        :class="{ 'checkerboard': showCheckerboard }"
        :style="{ backgroundColor: showCheckerboard ? '' : supportColor }"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseUp"
      >
        <canvas
          ref="canvasRef"
          class="preview-canvas"
          :style="{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default'
          }"
        />
      </div>
    </template>
  </div>
</template>
