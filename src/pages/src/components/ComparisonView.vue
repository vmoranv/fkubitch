<script setup lang="ts">
import { computed } from 'vue';
import { useChallengeStore } from '@/stores/challenge';

const store = useChallengeStore();

const stdPositions = computed(() => {
  const json = store.currentChallenge?.answer_key_json;
  return json ? (JSON.parse(json).positions as number[]) : [];
});

const userPositions = computed(() => {
  const text = store.submitResult?.segmented_text || store.practiceResult?.segmented_text || '';
  const raw = store.currentChallenge?.raw_text || '';
  const pos: number[] = [];
  let ri = 0;
  for (const ch of text) {
    if (ch === '|') { pos.push(ri); }
    else if (ri < raw.length && ch === raw[ri]) { ri++; }
  }
  return pos;
});

const chars = computed(() => (store.currentChallenge?.raw_text || '').split(''));
</script>

<template>
  <div class="space-y-4" v-if="store.currentChallenge && userPositions.length">
    <!-- Standard answer -->
    <div class="card p-4 stagger-1">
      <h3 class="text-11px font-bold text-green-400 uppercase tracking-wider mb-3">标准分割</h3>
      <p class="text-xl sm:text-2xl font-bold text-ph-text leading-relaxed tracking-wider text-center">
        <template v-for="(ch, idx) in chars" :key="idx">
          <span :class="stdPositions.includes(idx) ? 'text-green-400' : ''">{{ ch }}</span>
          <span v-if="stdPositions.includes(idx + 1)" class="text-green-400 mx-0.5 font-bold">│</span>
        </template>
      </p>
    </div>

    <!-- User answer -->
    <div class="card p-4 stagger-2">
      <h3 class="text-11px font-bold text-ph-gold uppercase tracking-wider mb-3">你的分割</h3>
      <p class="text-xl sm:text-2xl font-bold text-ph-text leading-relaxed tracking-wider text-center">
        <template v-for="(ch, idx) in chars" :key="idx">
          <span :class="[
            userPositions.includes(idx) && stdPositions.includes(idx) ? 'text-green-400' :
            userPositions.includes(idx) ? 'text-ph-gold' : ''
          ]">{{ ch }}</span>
          <span v-if="userPositions.includes(idx + 1)" :class="[
            stdPositions.includes(idx + 1) ? 'text-green-400' :
            'text-red-400'
          ]" class="mx-0.5 font-bold">│</span>
        </template>
      </p>
      <div class="flex justify-center gap-4 mt-3 text-11px">
        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-400 inline-block" /> 正确</span>
        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-400 inline-block" /> 多余/缺失</span>
      </div>
    </div>
  </div>
</template>
