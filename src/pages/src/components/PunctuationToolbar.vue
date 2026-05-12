<script setup lang="ts">
import { ref, watch } from 'vue';
import { useChallengeStore } from '@/stores/challenge';
import { useAuthStore } from '@/stores/auth';
import { useSegment } from '@/composables/useSegment';
import GapEditor from './GapEditor.vue';
import { Trash2, Undo2, SendHorizonal } from 'lucide-vue-next';

const store = useChallengeStore();
const auth = useAuthStore();
const { submitForScore } = useSegment();

const message = ref('');
const messageType = ref<'success' | 'error' | ''>('');
const editorRef = ref<InstanceType<typeof GapEditor> | null>(null);

const rawText = ref(store.currentChallenge?.raw_text || '');
const segmentedText = ref(store.currentChallenge?.raw_text || '');

watch(() => store.currentChallenge, (c) => {
  if (c) { rawText.value = c.raw_text; segmentedText.value = c.raw_text; }
});

watch(segmentedText, (v) => store.syncFromEditor(v));

async function handleSubmit() {
  if (auth.isGuest) { auth.openLogin(); return; }
  message.value = '提交中...'; messageType.value = '';
  const r = await submitForScore('test');
  if (r) { message.value = `得分 ${r.score_total}`; messageType.value = 'success'; }
  else { message.value = '提交失败'; messageType.value = 'error'; }
  setTimeout(() => message.value = '', 4000);
}
</script>

<template>
  <div class="space-y-4 stagger-1" v-if="store.currentChallenge">
    <GapEditor ref="editorRef" :raw-text="rawText" v-model="segmentedText" />

    <div class="flex justify-center gap-2 flex-wrap">
      <button @click="editorRef?.clear()" class="btn-ghost text-11px"><Trash2 class="w-3 h-3" />清空</button>
      <button @click="editorRef?.undo()" class="btn-ghost text-11px"><Undo2 class="w-3 h-3" />撤销</button>
      <button @click="handleSubmit" :disabled="store.isSubmitting" class="btn-primary text-11px"><SendHorizonal class="w-3 h-3" />提交</button>
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
