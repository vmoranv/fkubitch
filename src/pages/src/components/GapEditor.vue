<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{ rawText: string; modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const hoveredGap = ref<number | null>(null);
const bouncedGap = ref<number | null>(null);

const chars = computed(() => props.rawText.split(''));

const segments = computed(() => {
  const pos = new Set<number>();
  const text = props.modelValue;
  let ri = 0;
  for (const ch of text) {
    if (ch === '|') { pos.add(ri); }
    else if (ri < props.rawText.length && ch === props.rawText[ri]) { ri++; }
  }
  return pos;
});

function toggleGap(pos: number) {
  const s = new Set(segments.value);
  if (s.has(pos)) s.delete(pos);
  else { s.add(pos); bouncedGap.value = pos; setTimeout(() => bouncedGap.value = null, 400); }
  emitUpdate(s);
}

function emitUpdate(s: Set<number>) {
  const sorted = [...s].sort((a, b) => a - b);
  let r = '', p = 0;
  for (const pos of sorted) { r += props.rawText.slice(p, pos) + '|'; p = pos; }
  emit('update:modelValue', r + props.rawText.slice(p));
}

function clear() { emit('update:modelValue', props.rawText); }
function undo() {
  const arr = [...segments.value].sort((a, b) => b - a);
  if (!arr.length) return;
  const s = new Set(segments.value);
  s.delete(arr[0]);
  emitUpdate(s);
}

defineExpose({ clear, undo });
</script>

<template>
  <div class="bg-ph-surface py-8 px-5 sm:py-10 sm:px-8 select-none text-center overflow-x-auto">
    <p class="text-2xl sm:text-3xl font-black text-ph-text leading-relaxed tracking-wider inline-block whitespace-nowrap min-w-max">
      <template v-for="(ch, idx) in chars" :key="idx">
        <span
          :class="[
            'inline-block transition-transform duration-200 ease-spring',
            hoveredGap === idx + 1 ? '-translate-x-1.5' : '',
            hoveredGap === idx ? 'translate-x-1.5' : '',
          ]"
        >{{ ch }}</span>
        <span
          v-if="idx < chars.length - 1"
          @click="toggleGap(idx + 1)"
          @mouseenter="hoveredGap = idx + 1"
          @mouseleave="hoveredGap = null"
          :class="[
            'inline-flex items-center justify-center w-2.5 h-7 sm:h-9 align-middle cursor-pointer transition-all duration-200 ease-spring',
            segments.has(idx + 1)
              ? 'text-ph-gold'
              : hoveredGap === idx + 1
                ? 'text-ph-gold/40 w-4'
                : 'text-ph-muted/15',
            bouncedGap === idx + 1 ? 'scale-150 text-ph-gold' : '',
          ]"
        >│</span>
      </template>
    </p>
  </div>
</template>
