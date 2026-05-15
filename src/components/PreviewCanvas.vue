<script setup lang="ts">
import { ref, watch, computed } from 'vue';

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

// Design specific state in mockup mode
const designX = ref(0);
const designY = ref(0);
const designScale = ref(1);
const isDraggingDesign = ref(false);

let lastMouse = { x: 0, y: 0 };

function zoomIn() { zoom.value = Math.min(zoom.value * 1.25, 5); }
function zoomOut() { zoom.value = Math.max(zoom.value / 1.25, 0.1); }
function zoomFit() { 
  zoom.value = 1; 
  panX.value = 0; 
  panY.value = 0; 
  designX.value = 0;
  designY.value = 0;
  designScale.value = 1;
}

function onMouseDown(e: MouseEvent) {
  lastMouse = { x: e.clientX, y: e.clientY };
  
  if (props.mockupMode) {
    const target = e.target as HTMLElement;
    if (target.closest('.mockup-design-area')) {
      isDraggingDesign.value = true;
      return;
    }
  }
  
  if (zoom.value > 1 || props.mockupMode) {
    isPanning.value = true;
  }
}
function onMouseMove(e: MouseEvent) {
  if (!isPanning.value && !isDraggingDesign.value) return;
  
  const dx = e.clientX - lastMouse.x;
  const dy = e.clientY - lastMouse.y;
  
  if (isDraggingDesign.value) {
    designX.value += dx / zoom.value;
    designY.value += dy / zoom.value;
  } else {
    panX.value += dx;
    panY.value += dy;
  }
  
  lastMouse = { x: e.clientX, y: e.clientY };
}
function onMouseUp() { 
  isPanning.value = false; 
  isDraggingDesign.value = false;
}

function onWheel(e: WheelEvent) {
  if (props.mockupMode) {
    const target = e.target as HTMLElement;
    if (target.closest('.mockup-design-area')) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      designScale.value = Math.max(0.1, Math.min(designScale.value * delta, 3));
      return;
    }
  }
}

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

// Shirt path for reuse
const shirtPath = "M20,15 L30,12 C30,12 35,8 50,8 C65,8 70,12 70,12 L80,15 L85,38 L75,42 L75,92 L25,92 L25,42 L15,38 Z";
</script>

<template>
  <div class="preview-area" :class="{ 'preview-area--mockup': mockupMode }" @wheel="onWheel">
    <div v-if="!hasImage" class="preview-empty">
      <svg class="preview-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <p>Importez une image pour commencer</p>
    </div>

    <template v-else>
      <!-- Zoom controls -->
      <div class="zoom-controls">
        <div v-if="mockupMode" class="design-scale-control">
          <span class="zoom-label">Design</span>
          <input 
            type="range" 
            min="0.1" 
            max="3" 
            step="0.05" 
            v-model.number="designScale" 
            class="design-scale-slider"
          >
          <span class="zoom-label">{{ Math.round(designScale * 100) }}%</span>
          <div class="zoom-divider"></div>
        </div>
        
        <button class="zoom-btn" @click="zoomOut" title="Zoom -">−</button>
        <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
        <button class="zoom-btn" @click="zoomIn" title="Zoom +">+</button>
        <button class="zoom-btn" @click="zoomFit" title="Réinitialiser">⊡</button>
      </div>

      <!-- Mockup instructions -->
      <div v-if="mockupMode" class="mockup-hint">
        Glissez pour placer le design • Molette pour redimensionner
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
            <defs>
              <radialGradient id="shirtShading" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stop-color="white" stop-opacity="0.1" />
                <stop offset="50%" stop-color="black" stop-opacity="0" />
                <stop offset="100%" stop-color="black" stop-opacity="0.2" />
              </radialGradient>
              
              <filter id="fabricTexture" x="0%" y="0%" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
                <feDiffuseLighting in="noise" lighting-color="white" surfaceScale="1" result="diffuse">
                  <feDistantLight azimuth="45" elevation="60" />
                </feDiffuseLighting>
                <feComposite in="diffuse" in2="SourceGraphic" operator="arithmetic" k1="0.1" k2="0.9" k3="0" k4="0" />
              </filter>

              <clipPath id="shirtClip">
                <path :d="shirtPath" />
              </clipPath>
            </defs>

            <!-- Shirt Base -->
            <path :d="shirtPath" :fill="supportColor" />
            
            <!-- Fabric Texture & Shading -->
            <path :d="shirtPath" fill="url(#shirtShading)" style="mix-blend-mode: multiply;" />
            <path :d="shirtPath" fill="white" fill-opacity="0.05" filter="url(#fabricTexture)" />
            
            <!-- Subtle Folds -->
            <path d="M28,40 Q35,45 42,40" fill="none" stroke="black" stroke-opacity="0.05" stroke-width="1" />
            <path d="M58,40 Q65,45 72,40" fill="none" stroke="black" stroke-opacity="0.05" stroke-width="1" />
            <path d="M30,70 Q50,75 70,70" fill="none" stroke="black" stroke-opacity="0.03" stroke-width="1.5" />

            <!-- Neck detail -->
            <path d="M35,12 C35,12 40,16 50,16 C60,16 65,12 65,12" fill="none" stroke="black" stroke-opacity="0.1" stroke-width="0.5" />
          </svg>
          
          <div 
            class="mockup-design-area" 
            :style="{ 
              transform: `translate(calc(-50% + ${designX}px), calc(-50% + ${designY}px)) scale(${designScale})`,
              pointerEvents: 'auto'
            }"
          >
            <canvas
              ref="canvasRef"
              class="preview-canvas"
              :style="{
                cursor: isDraggingDesign ? 'grabbing' : 'grab'
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
