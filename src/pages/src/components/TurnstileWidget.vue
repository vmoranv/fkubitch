<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
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

function tryRender() {
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

// Site key arrives async from /api/auth/config; render once it lands.
// The script tag in index.html may also still be loading — poll briefly.
watch(siteKey, () => {
  if (!siteKey.value) return;
  if (window.turnstile) { tryRender(); return; }
  const id = setInterval(() => {
    if (window.turnstile) { clearInterval(id); tryRender(); }
  }, 200);
  // Stop polling after 10s no matter what.
  setTimeout(() => clearInterval(id), 10_000);
}, { immediate: true });

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
