<script setup lang="ts">
/**
 * DTF Halftone Maker — Main Application Layout
 *
 * Two-column layout:
 * - Left sidebar: uploader, controls, export
 * - Right main area: preview canvas
 */
import { onMounted, onUnmounted } from 'vue';
import Uploader from './components/Uploader.vue';
import ControlsPanel from './components/ControlsPanel.vue';
import PreviewCanvas from './components/PreviewCanvas.vue';
import ExportButtons from './components/ExportButtons.vue';
import { useHalftone } from './composables/useHalftone';

const {
  settings,
  updateSettings,
  resetSettings,
  imageInfo,
  isLoading,
  loadAndProcess,
  isProcessing,
  progress,
  resultImageData,
  resultDataUrl,
  thumbnailUrl,
  processImage,
  undo,
  redo,
  canUndo,
  canRedo,
  exportPNG,
  exportSVG,
} = useHalftone();

function onFileSelected(file: File) {
  loadAndProcess(file);
}

// Keyboard shortcuts
function onKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    redo();
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown));
onUnmounted(() => window.removeEventListener('keydown', onKeyDown));
</script>

<template>
  <div class="app-layout">
    <!-- Header -->
    <header class="app-header">
      <div class="app-header__brand">
        <svg class="app-header__logo" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" stroke="url(#logo-grad)" stroke-width="2.5" />
          <circle cx="11" cy="11" r="3" fill="url(#logo-grad)" opacity="0.9" />
          <circle cx="21" cy="11" r="2.2" fill="url(#logo-grad)" opacity="0.7" />
          <circle cx="11" cy="21" r="2.2" fill="url(#logo-grad)" opacity="0.7" />
          <circle cx="21" cy="21" r="4" fill="url(#logo-grad)" opacity="1" />
          <circle cx="16" cy="16" r="1.5" fill="url(#logo-grad)" opacity="0.5" />
          <defs>
            <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
              <stop offset="0%" stop-color="#6366f1" />
              <stop offset="100%" stop-color="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>
        <h1 class="app-header__title">DTF Halftone Maker</h1>
      </div>
      <span class="app-header__badge">100% Local</span>
    </header>

    <!-- Main content -->
    <div class="app-content">
      <!-- Left Sidebar -->
      <aside class="sidebar">
        <div class="sidebar__scroll">
          <Uploader
            :imageInfo="imageInfo"
            :isLoading="isLoading"
            @file-selected="onFileSelected"
          />

          <ControlsPanel
            v-if="imageInfo"
            :settings="settings"
            :canUndo="canUndo"
            :canRedo="canRedo"
            :isProcessing="isProcessing"
            :hasImage="!!imageInfo"
            @update="updateSettings"
            @undo="undo"
            @redo="redo"
            @reset="resetSettings"
            @process="processImage"
          />

          <ExportButtons
            v-if="imageInfo"
            :hasResult="!!resultImageData"
            :isProcessing="isProcessing"
            @export-png="exportPNG"
            @export-svg="exportSVG"
          />
        </div>
      </aside>

      <!-- Preview Area -->
      <main class="main-preview">
        <PreviewCanvas
          :resultDataUrl="resultDataUrl"
          :thumbnailUrl="thumbnailUrl"
          :isProcessing="isProcessing"
          :progress="progress"
          :hasImage="!!imageInfo"
          :supportColor="settings.supportColor"
          :showCheckerboard="settings.showCheckerboard"
        />
      </main>
    </div>
  </div>
</template>
