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
  mockupMode: boolean;
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
  if (zoom.value > 1 || props.mockupMode) {
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

const currentImg = ref<HTMLImageElement | null>(null);

function drawImage() {
  if (!currentImg.value || !canvasRef.value) return;
  const ctx = canvasRef.value.getContext('2d');
  if (!ctx) return;
  
  canvasRef.value.width = currentImg.value.width;
  canvasRef.value.height = currentImg.value.height;
  ctx.clearRect(0, 0, currentImg.value.width, currentImg.value.height);
  ctx.drawImage(currentImg.value, 0, 0);
}

watch(() => props.resultDataUrl, (url) => {
  if (!url) {
    currentImg.value = null;
    return;
  }
  const img = new Image();
  img.onload = () => {
    currentImg.value = img;
    drawImage();
  };
  img.src = url;
});

// Redraw when switching modes or when canvas is ready
watch([() => props.mockupMode, canvasRef], () => {
  // Use nextTick or a small timeout to ensure the DOM has updated
  setTimeout(drawImage, 0);
});
</script>

<template>
  <div class="preview-area" :class="{ 'preview-area--mockup': mockupMode }">
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

      <!-- Canvas Wrapper -->
      <div
        class="preview-canvas-wrapper"
        :class="{ 'checkerboard': showCheckerboard && !mockupMode }"
        :style="{ backgroundColor: (showCheckerboard || mockupMode) ? '' : supportColor }"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseUp"
      >
        <div v-if="mockupMode" class="mockup-container" :style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }">
          <svg class="mockup-shirt" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            <path 
              class="shirt-path"
              d="M20,15 L30,10 L35,12 C35,12 40,8 50,8 C60,8 65,12 65,12 L70,10 L80,15 L85,35 L75,40 L75,90 L25,90 L25,40 L15,35 Z" 
              :fill="supportColor" 
            />
            <path 
              class="shirt-shading"
              d="M20,15 L30,10 L35,12 C35,12 40,8 50,8 C60,8 65,12 65,12 L70,10 L80,15 L85,35 L75,40 L75,90 L25,90 L25,40 L15,35 Z" 
              fill="black" 
              fill-opacity="0.1" 
            />
            <!-- Neck detail -->
            <path d="M35,12 C35,12 40,16 50,16 C60,16 65,12 65,12" fill="none" stroke="black" stroke-opacity="0.1" stroke-width="0.5" />
          </svg>
          
          <div class="mockup-design-area">
            <canvas
              ref="canvasRef"
              class="preview-canvas"
              :style="{
                cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default'
              }"
            />
          </div>
        </div>
        
        <canvas
          v-else
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
