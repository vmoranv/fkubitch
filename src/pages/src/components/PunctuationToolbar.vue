<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useChallengeStore } from '@/stores/challenge';
import { useAuthStore } from '@/stores/auth';
import { useSegment } from '@/composables/useSegment';
import { Trash2, Undo2, SendHorizonal } from 'lucide-vue-next';

const store = useChallengeStore();
const auth = useAuthStore();
const { submitForScore } = useSegment();

const message = ref('');
const messageType = ref<'success' | 'error' | ''>('');
const hoveredGap = ref<number | null>(null);
const bouncedGap = ref<number | null>(null);
const segments = ref<Set<number>>(new Set());

watch(() => store.currentChallenge, () => { segments.value = new Set(); });

const chars = computed(() => (store.currentChallenge?.raw_text || '').split(''));

function toggleGap(pos: number) {
  const s = new Set(segments.value);
  if (s.has(pos)) { s.delete(pos); }
  else { s.add(pos); bouncedGap.value = pos; setTimeout(() => bouncedGap.value = null, 400); }
  segments.value = s;
  store.syncFromEditor(buildText());
}

function buildText(): string {
  const text = store.currentChallenge?.raw_text || '';
  const sorted = [...segments.value].sort((a, b) => a - b);
  let r = '', p = 0;
  for (const pos of sorted) { r += text.slice(p, pos) + '|'; p = pos; }
  return r + text.slice(p);
}

function clearAll() { segments.value = new Set(); store.syncFromEditor(store.currentChallenge?.raw_text || ''); message.value = ''; }
function undoLast() {
  const arr = [...segments.value]; if (!arr.length) return;
  const s = new Set(segments.value); s.delete(arr[arr.length - 1]); segments.value = s;
  store.syncFromEditor(buildText());
}

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
  <div class="space-y-4 stagger-1">
    <!-- Editor -->
    <div class="bg-ph-surface py-12 px-6 sm:py-16 sm:px-10 select-none text-center overflow-x-auto">
      <p class="text-3xl sm:text-4xl font-black text-ph-text leading-relaxed tracking-wider inline-block whitespace-nowrap min-w-max">
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
              'inline-flex items-center justify-center w-2.5 h-8 sm:h-10 align-middle cursor-pointer transition-all duration-200 ease-spring',
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

    <!-- Actions -->
    <div class="flex justify-center gap-2 flex-wrap">
      <button @click="clearAll" class="btn-ghost text-11px"><Trash2 class="w-3 h-3" />清空</button>
      <button @click="undoLast" class="btn-ghost text-11px"><Undo2 class="w-3 h-3" />撤销</button>
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
