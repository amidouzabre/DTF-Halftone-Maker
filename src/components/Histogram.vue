<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

const props = defineProps<{
  imageData: ImageData | null;
  levelsBlack: number;
  levelsWhite: number;
  levelsMid: number;
  outputLevelsBlack: number;
  outputLevelsWhite: number;
}>();

const emit = defineEmits<{
  (e: 'update:levelsBlack', value: number): void;
  (e: 'update:levelsWhite', value: number): void;
  (e: 'update:levelsMid', value: number): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const histogramData = ref<number[]>(new Array(256).fill(0));
const isDragging = ref<'black' | 'white' | 'mid' | null>(null);

function computeHistogram() {
  if (!props.imageData) {
    histogramData.value = new Array(256).fill(0);
    return;
  }

  const data = props.imageData.data;
  const hist = new Array(256).fill(0);
  
  // Sample data for performance on large images
  const totalPixels = data.length / 4;
  const step = Math.max(1, Math.floor(totalPixels / 1000000)) * 4;
  
  for (let i = 0; i < data.length; i += step) {
    const a = data[i + 3];
    if (a < 10) continue; 

    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    
    const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    hist[lum]++;
  }

  histogramData.value = hist;
  draw();
}

function getHandles() {
  const canvas = canvasRef.value;
  if (!canvas) return { bX: 0, wX: 0, mX: 0 };
  const w = canvas.width;
  
  const bX = (props.levelsBlack / 255) * w;
  const wX = (props.levelsWhite / 255) * w;
  
  // Midpoint (Gamma) calculation
  // Gamma = log(0.5) / log((midValue - black) / (white - black))
  // We calculate mX from midVal:
  const midVal = Math.pow(0.5, props.levelsMid);
  const mX = bX + midVal * (wX - bX);
  
  return { bX, wX, mX };
}

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const histH = h - 16; 
  const hist = histogramData.value;
  
  const max = Math.max(...hist);

  ctx.clearRect(0, 0, w, h);

  // Draw background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, w, histH);

  // Draw bars
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  for (let i = 0; i < 256; i++) {
    const val = (hist[i] / (max || 1)) * histH;
    const x = (i / 255) * w;
    ctx.fillRect(x, histH - val, w / 256 + 1, val);
  }

  const { bX, wX, mX } = getHandles();

  // Draw connectors
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bX, histH); ctx.lineTo(mX, histH); ctx.lineTo(wX, histH);
  ctx.stroke();

  // Helper to draw handle
  const drawHandle = (x: number, color: string, active: boolean) => {
    ctx.fillStyle = color;
    ctx.shadowBlur = active ? 8 : 0;
    ctx.shadowColor = color;
    
    // Triangle
    ctx.beginPath();
    ctx.moveTo(x, histH - 2);
    ctx.lineTo(x - 5, histH + 6);
    ctx.lineTo(x + 5, histH + 6);
    ctx.fill();
    
    // Line
    ctx.strokeStyle = color;
    ctx.lineWidth = active ? 2 : 1;
    ctx.setLineDash(active ? [] : [2, 2]);
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, histH - 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  };

  drawHandle(bX, '#ef4444', isDragging.value === 'black');
  drawHandle(wX, '#22c55e', isDragging.value === 'white');
  drawHandle(mX, '#3b82f6', isDragging.value === 'mid');

  // Draw Output Bar
  const obX = (props.outputLevelsBlack / 255) * w;
  const owX = (props.outputLevelsWhite / 255) * w;
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(0, h - 4, w, 3);
  
  const gradient = ctx.createLinearGradient(obX, 0, owX, 0);
  gradient.addColorStop(0, '#000');
  gradient.addColorStop(1, '#fff');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(Math.min(obX, owX), h - 4, Math.abs(owX - obX), 3);
}

function handleStart(e: MouseEvent | TouchEvent) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const x = (clientX - rect.left) * (canvas.width / rect.width);
  
  const { bX, wX, mX } = getHandles();
  const threshold = 10;
  
  if (Math.abs(x - mX) < threshold) isDragging.value = 'mid';
  else if (Math.abs(x - bX) < threshold) isDragging.value = 'black';
  else if (Math.abs(x - wX) < threshold) isDragging.value = 'white';
  
  if (isDragging.value) {
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    draw();
  }
}

function handleMove(e: MouseEvent | TouchEvent) {
  if (!isDragging.value || !canvasRef.value) return;
  if ('cancelable' in e && e.cancelable) e.preventDefault();

  const canvas = canvasRef.value;
  const rect = canvas.getBoundingClientRect();
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const x = Math.max(0, Math.min(canvas.width, (clientX - rect.left) * (canvas.width / rect.width)));
  const val = Math.round((x / canvas.width) * 255);

  if (isDragging.value === 'black') {
    emit('update:levelsBlack', Math.min(val, props.levelsWhite - 1));
  } else if (isDragging.value === 'white') {
    emit('update:levelsWhite', Math.max(val, props.levelsBlack + 1));
  } else if (isDragging.value === 'mid') {
    // Reverse gamma calculation
    // x = bX + midVal * (wX - bX) => midVal = (x - bX) / (wX - bX)
    const { bX, wX } = getHandles();
    const range = wX - bX;
    if (range > 0) {
      const midVal = Math.max(0.01, Math.min(0.99, (x - bX) / range));
      // midVal = 0.5 ^ gamma => gamma = log(midVal) / log(0.5)
      const gamma = Math.log(midVal) / Math.log(0.5);
      emit('update:levelsMid', parseFloat(gamma.toFixed(2)));
    }
  }
}

function handleEnd() {
  isDragging.value = null;
  window.removeEventListener('mousemove', handleMove);
  window.removeEventListener('mouseup', handleEnd);
  window.removeEventListener('touchmove', handleMove);
  window.removeEventListener('touchend', handleEnd);
  draw();
}

onMounted(computeHistogram);
watch(() => props.imageData, computeHistogram);
watch(() => [
  props.levelsBlack, 
  props.levelsWhite, 
  props.levelsMid, 
  props.outputLevelsBlack, 
  props.outputLevelsWhite
], draw);

</script>

<template>
  <div class="histogram-container">
    <canvas 
      ref="canvasRef" 
      width="256" 
      height="80" 
      class="histogram-canvas"
      @mousedown="handleStart"
      @touchstart="handleStart"
    ></canvas>
    <div class="histogram-labels">
      <span>Shadows</span>
      <span>Midtones</span>
      <span>Highlights</span>
    </div>
  </div>
</template>

<style scoped>
.histogram-container {
  margin-bottom: 12px;
  background: var(--bg-darker);
  border-radius: 4px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  user-select: none;
}

.histogram-canvas {
  width: 100%;
  height: 80px;
  display: block;
  cursor: crosshair;
  touch-action: none;
}

.histogram-labels {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  margin-top: 6px;
  padding: 0 4px;
}
</style>
