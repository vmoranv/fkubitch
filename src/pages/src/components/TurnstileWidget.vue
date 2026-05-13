<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{
  modelValue: string;
  theme?: 'light' | 'dark' | 'auto';
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const auth = useAuthStore();
const siteKey = computed(() => auth.turnstileSiteKey);
const containerRef = ref<HTMLDivElement | null>(null);
const widgetId = ref<string | null>(null);

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

function render() {
  if (!siteKey.value || !containerRef.value || widgetId.value) return;
  if (!window.turnstile) return;
  widgetId.value = window.turnstile.render(containerRef.value, {
    sitekey: siteKey.value,
    theme: props.theme ?? 'dark',
    callback: (token: string) => emit('update:modelValue', token),
    'expired-callback': () => emit('update:modelValue', ''),
    'error-callback': () => emit('update:modelValue', ''),
  });
}

onMounted(() => {
  if (!siteKey.value) return;
  if (window.turnstile) { render(); return; }
  // Script is ?render=explicit so it won't auto-render; wait for it to load.
  const id = setInterval(() => {
    if (window.turnstile) { clearInterval(id); render(); }
  }, 200);
  setTimeout(() => clearInterval(id), 10_000);
});

watch(() => props.modelValue, (v) => {
  if (!v && widgetId.value && window.turnstile) {
    window.turnstile.reset(widgetId.value);
  }
});

onBeforeUnmount(() => {
  if (widgetId.value && window.turnstile) {
    window.turnstile.remove(widgetId.value);
    widgetId.value = null;
  }
});
</script>

<template>
  <div v-if="siteKey" ref="containerRef" class="flex justify-center"></div>
</template>
