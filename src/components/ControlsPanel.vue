<script setup lang="ts">
import { ref } from 'vue';
import type { HalftoneSettings, DotShape } from '../types/halftone';
import DotShapeSelector from './DotShapeSelector.vue';

const props = defineProps<{
  settings: HalftoneSettings;
  canUndo: boolean;
  canRedo: boolean;
  isProcessing: boolean;
  hasImage: boolean;
}>();

const emit = defineEmits<{
  (e: 'update', partial: Partial<HalftoneSettings>): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'reset'): void;
  (e: 'process'): void;
}>();

const sections = ref({
  grid: true, dots: true, threshold: true,
  color: true, quality: false, manual: false,
});

function toggle(key: keyof typeof sections.value) {
  sections.value[key] = !sections.value[key];
}

function update(partial: Partial<HalftoneSettings>) {
  emit('update', partial);
}

function updateManual(key: string, value: number) {
  emit('update', {
    manualValues: { ...props.settings.manualValues, [key]: value },
  });
}
</script>

<template>
  <div class="controls-panel">
    <!-- Actions bar -->
    <div class="controls-actions">
      <button class="action-btn" :disabled="!canUndo" title="Annuler" @click="emit('undo')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="action-btn" :disabled="!canRedo" title="Rétablir" @click="emit('redo')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="action-btn action-btn--reset" title="Réinitialiser" @click="emit('reset')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button v-if="hasImage" class="action-btn action-btn--process" :disabled="isProcessing" title="Appliquer" @click="emit('process')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>

    <!-- Grid -->
    <div class="control-section">
      <button class="section-header" @click="toggle('grid')">
        <span>Grille</span>
        <svg class="section-chevron" :class="{ 'section-chevron--open': sections.grid }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div v-show="sections.grid" class="section-content">
        <div class="control-row">
          <label class="control-label">Taille de la grille</label>
          <div class="control-input-group">
            <input type="range" min="2" max="50" step="1" :value="settings.gridSize" @input="update({ gridSize: Number(($event.target as HTMLInputElement).value) })" class="control-slider" />
            <input type="number" min="2" max="50" :value="settings.gridSize" @change="update({ gridSize: Number(($event.target as HTMLInputElement).value) })" class="control-number" />
          </div>
        </div>
        <div class="control-row">
          <label class="control-label">Angle (°)</label>
          <div class="control-input-group">
            <input type="range" min="0" max="360" step="1" :value="settings.angle" @input="update({ angle: Number(($event.target as HTMLInputElement).value) })" class="control-slider" />
            <input type="number" min="0" max="360" :value="settings.angle" @change="update({ angle: Number(($event.target as HTMLInputElement).value) })" class="control-number" />
          </div>
        </div>
      </div>
    </div>

    <!-- Dots -->
    <div class="control-section">
      <button class="section-header" @click="toggle('dots')">
        <span>Points</span>
        <svg class="section-chevron" :class="{ 'section-chevron--open': sections.dots }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div v-show="sections.dots" class="section-content">
        <div class="control-row">
          <label class="control-label">Rayon max du point</label>
          <div class="control-input-group">
            <input type="range" min="1" max="25" step="0.5" :value="settings.maxDotRadius" @input="update({ maxDotRadius: Number(($event.target as HTMLInputElement).value) })" class="control-slider" />
            <input type="number" min="1" max="25" step="0.5" :value="settings.maxDotRadius" @change="update({ maxDotRadius: Number(($event.target as HTMLInputElement).value) })" class="control-number" />
          </div>
        </div>
        <div class="control-row">
          <label class="control-label">Densité</label>
          <div class="control-input-group">
            <input type="range" min="0.1" max="2" step="0.05" :value="settings.density" @input="update({ density: Number(($event.target as HTMLInputElement).value) })" class="control-slider" />
            <input type="number" min="0.1" max="2" step="0.05" :value="settings.density" @change="update({ density: Number(($event.target as HTMLInputElement).value) })" class="control-number" />
          </div>
        </div>
        <div class="control-row">
          <label class="control-label">Forme du point</label>
          <DotShapeSelector :modelValue="settings.dotShape" @update:modelValue="(v: DotShape) => update({ dotShape: v })" />
        </div>
      </div>
    </div>

    <!-- Threshold -->
    <div class="control-section">
      <button class="section-header" @click="toggle('threshold')">
        <span>Seuil & Intensité</span>
        <svg class="section-chevron" :class="{ 'section-chevron--open': sections.threshold }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div v-show="sections.threshold" class="section-content">
        <div class="control-row">
          <label class="control-label">Seuil</label>
          <div class="control-input-group">
            <input type="range" min="0" max="1" step="0.01" :value="settings.threshold" @input="update({ threshold: Number(($event.target as HTMLInputElement).value) })" class="control-slider" />
            <input type="number" min="0" max="1" step="0.01" :value="settings.threshold" @change="update({ threshold: Number(($event.target as HTMLInputElement).value) })" class="control-number" />
          </div>
        </div>
      </div>
    </div>

    <!-- Manual -->
    <div class="control-section">
      <button class="section-header" @click="toggle('manual')">
        <span>Valeurs manuelles</span>
        <svg class="section-chevron" :class="{ 'section-chevron--open': sections.manual }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div v-show="sections.manual" class="section-content">
        <div class="control-row">
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.useManualValues" @change="update({ useManualValues: ($event.target as HTMLInputElement).checked })" class="toggle-checkbox" />
            <span class="toggle-label">Utiliser les valeurs manuelles</span>
          </label>
        </div>
        <template v-if="settings.useManualValues">
          <div class="control-row">
            <label class="control-label">Taille</label>
            <div class="control-input-group">
              <input type="range" min="2" max="50" step="1" :value="settings.manualValues.size" @input="updateManual('size', Number(($event.target as HTMLInputElement).value))" class="control-slider" />
              <input type="number" min="2" max="50" :value="settings.manualValues.size" @change="updateManual('size', Number(($event.target as HTMLInputElement).value))" class="control-number" />
            </div>
          </div>
          <div class="control-row">
            <label class="control-label">Densité</label>
            <div class="control-input-group">
              <input type="range" min="0.1" max="2" step="0.05" :value="settings.manualValues.density" @input="updateManual('density', Number(($event.target as HTMLInputElement).value))" class="control-slider" />
              <input type="number" min="0.1" max="2" step="0.05" :value="settings.manualValues.density" @change="updateManual('density', Number(($event.target as HTMLInputElement).value))" class="control-number" />
            </div>
          </div>
          <div class="control-row">
            <label class="control-label">Seuil</label>
            <div class="control-input-group">
              <input type="range" min="0" max="1" step="0.01" :value="settings.manualValues.threshold" @input="updateManual('threshold', Number(($event.target as HTMLInputElement).value))" class="control-slider" />
              <input type="number" min="0" max="1" step="0.01" :value="settings.manualValues.threshold" @change="updateManual('threshold', Number(($event.target as HTMLInputElement).value))" class="control-number" />
            </div>
          </div>
          <div class="control-row">
            <label class="control-label">Lissage</label>
            <div class="control-input-group">
              <input type="range" min="1" max="4" step="1" :value="settings.manualValues.smoothing" @input="updateManual('smoothing', Number(($event.target as HTMLInputElement).value))" class="control-slider" />
              <input type="number" min="1" max="4" :value="settings.manualValues.smoothing" @change="updateManual('smoothing', Number(($event.target as HTMLInputElement).value))" class="control-number" />
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Color -->
    <div class="control-section">
      <button class="section-header" @click="toggle('color')">
        <span>Couleur & Transparence</span>
        <svg class="section-chevron" :class="{ 'section-chevron--open': sections.color }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div v-show="sections.color" class="section-content">
        <div class="control-row">
          <label class="control-label">Cible d'impression</label>
          <div class="target-selector">
            <button 
              class="target-btn" 
              :class="{ 'target-btn--active': settings.targetBackground === 'dark' }" 
              @click="update({ targetBackground: 'dark' })"
            >
              Vêtement Sombre
            </button>
            <button 
              class="target-btn" 
              :class="{ 'target-btn--active': settings.targetBackground === 'light' }" 
              @click="update({ targetBackground: 'light' })"
            >
              Vêtement Clair
            </button>
          </div>
        </div>
        <div class="control-row">
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.preserveColor" @change="update({ preserveColor: ($event.target as HTMLInputElement).checked })" class="toggle-checkbox" />
            <span class="toggle-label">Conserver la couleur</span>
          </label>
        </div>
        <div class="control-row">
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.makeBlackTransparent" @change="update({ makeBlackTransparent: ($event.target as HTMLInputElement).checked })" class="toggle-checkbox" />
            <span class="toggle-label">Noir transparent (DTF)</span>
          </label>
        </div>
        <div v-if="settings.makeBlackTransparent" class="control-row">
          <label class="control-label">Seuil noir</label>
          <div class="control-input-group">
            <input type="range" min="0.01" max="0.5" step="0.01" :value="settings.blackThreshold" @input="update({ blackThreshold: Number(($event.target as HTMLInputElement).value) })" class="control-slider" />
            <input type="number" min="0.01" max="0.5" step="0.01" :value="settings.blackThreshold" @change="update({ blackThreshold: Number(($event.target as HTMLInputElement).value) })" class="control-number" />
          </div>
        </div>
        <div class="control-row">
          <label class="control-label">Luminosité des blancs</label>
          <div class="control-input-group">
            <input type="range" min="1" max="2" step="0.05" :value="settings.brightnessBoost" @input="update({ brightnessBoost: Number(($event.target as HTMLInputElement).value) })" class="control-slider" />
            <input type="number" min="1" max="2" step="0.05" :value="settings.brightnessBoost" @change="update({ brightnessBoost: Number(($event.target as HTMLInputElement).value) })" class="control-number" />
          </div>
        </div>
      </div>
    </div>

    <!-- Quality -->
    <div class="control-section">
      <button class="section-header" @click="toggle('quality')">
        <span>Qualité & Résolution</span>
        <svg class="section-chevron" :class="{ 'section-chevron--open': sections.quality }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div v-show="sections.quality" class="section-content">
        <div class="control-row">
          <label class="control-label">Supersampling</label>
          <div class="supersample-selector">
            <button v-for="val in [1, 2, 4]" :key="val" class="ss-btn" :class="{ 'ss-btn--active': settings.supersample === val }" @click="update({ supersample: val })">{{ val }}×</button>
          </div>
        </div>
        <div class="control-row">
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.autoResize" @change="update({ autoResize: ($event.target as HTMLInputElement).checked })" class="toggle-checkbox" />
            <span class="toggle-label">Redimensionnement auto</span>
          </label>
        </div>
        <div v-if="settings.autoResize" class="control-row">
          <label class="control-label">Résolution max (px)</label>
          <input type="number" min="500" max="5000" step="100" :value="settings.maxResolution" @change="update({ maxResolution: Number(($event.target as HTMLInputElement).value) })" class="control-number control-number--full" />
        </div>
      </div>
    </div>
  </div>
</template>
