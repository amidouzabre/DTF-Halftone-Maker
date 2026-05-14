/**
 * Undo/Redo history composable for halftone settings.
 * Maintains a stack of past and future states with a maximum depth of 30.
 */

import { ref, computed } from 'vue';
import type { HalftoneSettings } from '../types/halftone';

export function useHistory(maxSize = 30) {
  const past = ref<HalftoneSettings[]>([]);
  const future = ref<HalftoneSettings[]>([]);

  const canUndo = computed(() => past.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);

  /**
   * Push a snapshot of the current settings to the history.
   * Clears the redo stack.
   */
  function push(settings: HalftoneSettings): void {
    past.value.push(JSON.parse(JSON.stringify(settings)));

    // Trim to max size
    if (past.value.length > maxSize) {
      past.value.shift();
    }

    // Clear redo stack on new action
    future.value = [];
  }

  /**
   * Undo: pop the last state from past, push current to future.
   * Returns the previous settings, or null if nothing to undo.
   */
  function undo(currentSettings: HalftoneSettings): HalftoneSettings | null {
    if (past.value.length === 0) return null;

    // Save current state to future
    future.value.push(JSON.parse(JSON.stringify(currentSettings)));

    // Restore previous state
    const previous = past.value.pop()!;
    return JSON.parse(JSON.stringify(previous));
  }

  /**
   * Redo: pop the last state from future, push current to past.
   * Returns the next settings, or null if nothing to redo.
   */
  function redo(currentSettings: HalftoneSettings): HalftoneSettings | null {
    if (future.value.length === 0) return null;

    // Save current state to past
    past.value.push(JSON.parse(JSON.stringify(currentSettings)));

    // Restore future state
    const next = future.value.pop()!;
    return JSON.parse(JSON.stringify(next));
  }

  /**
   * Clear all history.
   */
  function clear(): void {
    past.value = [];
    future.value = [];
  }

  return {
    canUndo,
    canRedo,
    push,
    undo,
    redo,
    clear,
  };
}
