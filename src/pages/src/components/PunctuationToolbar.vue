<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useChallengeStore } from '@/stores/challenge';
import { useAuthStore } from '@/stores/auth';
import { useSegment } from '@/composables/useSegment';
import GapEditor from './GapEditor.vue';
import TurnstileWidget from './TurnstileWidget.vue';
import { Trash2, Undo2, SendHorizonal } from 'lucide-vue-next';

const store = useChallengeStore();
const auth = useAuthStore();
const { submitForScore } = useSegment();

const message = ref('');
const messageType = ref<'success' | 'error' | ''>('');
const editorRef = ref<InstanceType<typeof GapEditor> | null>(null);
const turnstileToken = ref('');
const turnstileEnabled = computed(() => !!auth.turnstileSiteKey);

const rawText = ref(store.currentChallenge?.raw_text || '');
const segmentedText = ref(store.currentChallenge?.raw_text || '');

watch(() => store.currentChallenge, (c) => {
  if (c) { rawText.value = c.raw_text; segmentedText.value = c.raw_text; }
});

watch(segmentedText, (v) => store.syncFromEditor(v));

const submitDisabled = computed(() => store.isSubmitting);

async function getTurnstileToken(): Promise<string> {
  if (!turnstileEnabled.value || auth.isGuest) return '';
  // Prefer the reactive ref (populated by widget callback) but fall back to
  // reading the hidden input directly. Turnstile writes the response token to
  // <input name="cf-turnstile-response"> regardless of whether our Vue emit
  // chain worked, so this is always authoritative.
  if (turnstileToken.value) return turnstileToken.value;
  const el = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
  return el?.value || '';
}

async function handleSubmit() {
  if (auth.isGuest) { auth.openLogin(); return; }
  const token = await getTurnstileToken();
  if (turnstileEnabled.value && !token) {
    message.value = '请先完成人机验证'; messageType.value = 'error';
    return;
  }
  message.value = '提交中...'; messageType.value = '';
  const r = await submitForScore(token);
  if (r.data) { message.value = `得分 ${r.data.score_total}`; messageType.value = 'success'; }
  else { message.value = r.error || '提交失败'; messageType.value = 'error'; }
  // Turnstile token is single-use; clear so the widget re-issues a fresh one.
  turnstileToken.value = '';
  setTimeout(() => message.value = '', 4000);
}
</script>

<template>
  <div class="space-y-4 stagger-1" v-if="store.currentChallenge">
    <GapEditor ref="editorRef" :raw-text="rawText" v-model="segmentedText" />

    <TurnstileWidget v-if="!auth.isGuest" v-model="turnstileToken" />

    <div class="flex justify-center gap-2 flex-wrap">
      <button @click="editorRef?.clear()" class="btn-ghost text-11px"><Trash2 class="w-3 h-3" />清空</button>
      <button @click="editorRef?.undo()" class="btn-ghost text-11px"><Undo2 class="w-3 h-3" />撤销</button>
      <button @click="handleSubmit" :disabled="submitDisabled" class="btn-primary text-11px"><SendHorizonal class="w-3 h-3" />提交</button>
    </div>

    <Transition name="fade">
      <p v-if="message" :class="['text-center text-11px font-bold py-1.5',
        messageType === 'success' ? 'text-green-400' : messageType === 'error' ? 'text-red-400' : 'text-ph-gold']">{{ message }}</p>
    </Transition>

    <p v-if="auth.isGuest" class="text-center text-11px text-ph-muted">登录后提交获得积分和排名</p>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
