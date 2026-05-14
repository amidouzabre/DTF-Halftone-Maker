<script setup lang="ts">
/**
 * Dot shape selector with visual SVG previews.
 */
import type { DotShape } from '../types/halftone';

defineProps<{
  modelValue: DotShape;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', shape: DotShape): void;
}>();

const shapes: { id: DotShape; label: string }[] = [
  { id: 'round', label: 'Rond' },
  { id: 'square', label: 'Carré' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'diamond', label: 'Losange' },
  { id: 'line', label: 'Ligne' },
];
</script>

<template>
  <div class="shape-selector">
    <button
      v-for="shape in shapes"
      :key="shape.id"
      class="shape-btn"
      :class="{ 'shape-btn--active': modelValue === shape.id }"
      :title="shape.label"
      @click="emit('update:modelValue', shape.id)"
    >
      <svg viewBox="0 0 32 32" class="shape-btn__svg">
        <!-- Round -->
        <circle v-if="shape.id === 'round'" cx="16" cy="16" r="10" fill="currentColor" />
        <!-- Square -->
        <rect v-if="shape.id === 'square'" x="6" y="6" width="20" height="20" fill="currentColor" />
        <!-- Ellipse -->
        <ellipse v-if="shape.id === 'ellipse'" cx="16" cy="16" rx="12" ry="6" fill="currentColor" />
        <!-- Diamond -->
        <polygon v-if="shape.id === 'diamond'" points="16,4 28,16 16,28 4,16" fill="currentColor" />
        <!-- Line -->
        <rect v-if="shape.id === 'line'" x="4" y="13" width="24" height="6" rx="1" fill="currentColor" />
      </svg>
      <span class="shape-btn__label">{{ shape.label }}</span>
    </button>
  </div>
</template>
