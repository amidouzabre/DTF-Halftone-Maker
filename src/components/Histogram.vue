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

const canvasRef = ref<HTMLCanvasElement | null>(null);
const histogramData = ref<number[]>(new Array(256).fill(0));

function computeHistogram() {
  if (!props.imageData) {
    histogramData.value = new Array(256).fill(0);
    return;
  }

  const data = props.imageData.data;
  const hist = new Array(256).fill(0);
  
  // Sample data for performance on large images
  // Max ~1,000,000 samples for responsiveness
  const totalPixels = data.length / 4;
  const step = Math.max(1, Math.floor(totalPixels / 1000000)) * 4;
  
  for (let i = 0; i < data.length; i += step) {
    const a = data[i + 3];
    if (a < 10) continue; // Skip transparent pixels

    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    
    // Luminance formula
    const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    hist[lum]++;
  }

  histogramData.value = hist;
  draw();
}

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const histH = h - 12; // Leave space for output bar
  const hist = histogramData.value;
  
  // Find max with some headroom, ignore outliers if needed
  const max = Math.max(...hist);

  ctx.clearRect(0, 0, w, h);

  // Draw background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(0, 0, w, histH);

  // Draw bars
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  for (let i = 0; i < 256; i++) {
    const val = (hist[i] / (max || 1)) * histH;
    const x = (i / 255) * w;
    ctx.fillRect(x, histH - val, w / 256 + 1, val);
  }

  // Draw Input Levels markers
  const bX = (props.levelsBlack / 255) * w;
  const wX = (props.levelsWhite / 255) * w;
  
  // Midpoint (Gamma) calculation
  const midVal = Math.pow(0.5, props.levelsMid);
  const mX = (props.levelsBlack / 255 + midVal * (props.levelsWhite - props.levelsBlack) / 255) * w;

  ctx.lineWidth = 1.5;
  
  // Black point marker
  ctx.strokeStyle = '#ef4444'; 
  ctx.beginPath();
  ctx.moveTo(bX, 0); ctx.lineTo(bX, histH);
  ctx.stroke();

  // White point marker
  ctx.strokeStyle = '#22c55e';
  ctx.beginPath();
  ctx.moveTo(wX, 0); ctx.lineTo(wX, histH);
  ctx.stroke();

  // Mid point marker
  ctx.strokeStyle = '#3b82f6';
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(mX, 0); ctx.lineTo(mX, histH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Output Bar
  const obX = (props.outputLevelsBlack / 255) * w;
  const owX = (props.outputLevelsWhite / 255) * w;
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(0, h - 8, w, 4);
  
  const gradient = ctx.createLinearGradient(obX, 0, owX, 0);
  gradient.addColorStop(0, '#000');
  gradient.addColorStop(1, '#fff');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(Math.min(obX, owX), h - 8, Math.abs(owX - obX), 4);
  
  // Output markers
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(obX - 1, h - 10, 2, 8);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(owX - 1, h - 10, 2, 8);
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
    <canvas ref="canvasRef" width="256" height="72" class="histogram-canvas"></canvas>
    <div class="histogram-labels">
      <span>0</span>
      <span>128</span>
      <span>255</span>
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
}

.histogram-canvas {
  width: 100%;
  height: 72px;
  display: block;
}

.histogram-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-dim);
  margin-top: 4px;
}
</style>
