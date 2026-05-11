<script setup lang="ts">
import { useChallengeStore } from '@/stores/challenge';
import ModelResultList from './ModelResultList.vue';
import { Users } from 'lucide-vue-next';

const store = useChallengeStore();

function typeClass(type: string): string {
  switch (type) {
    case 'correct': return 'mark-correct';
    case 'incorrect': return 'mark-incorrect';
    case 'missing': return 'mark-missing';
    case 'extra': return 'mark-extra';
    default: return 'text-ph-text';
  }
}

interface DiffChar { char: string; type: 'normal' | 'correct' | 'incorrect' | 'missing' | 'extra'; }

function buildDiff(standard: string, user: string, forUser: boolean): DiffChar[] {
  const chars: DiffChar[] = [];
  const puncts = /[，。！？；：、,…\!\?\;\:\"\'\.]/;
  let si = 0, ui = 0;
  while (si < standard.length || ui < user.length) {
    const sc = standard[si], uc = user[ui];
    if (sc === uc) {
      chars.push({ char: forUser ? uc : sc, type: puncts.test(sc) ? 'correct' : 'normal' });
      si++; ui++;
    } else if (sc && puncts.test(sc) && (!uc || !puncts.test(uc))) {
      chars.push({ char: forUser ? '⌖' : sc, type: 'missing' }); si++;
    } else if (uc && puncts.test(uc) && (!sc || !puncts.test(sc))) {
      chars.push({ char: uc, type: 'extra' }); ui++;
    } else if (sc && uc && sc !== uc) {
      chars.push({ char: forUser ? uc : sc, type: 'incorrect' }); si++; ui++;
    } else if (sc) { chars.push({ char: sc, type: 'normal' }); si++; }
    else if (uc) { chars.push({ char: uc, type: 'extra' }); ui++; }
    else break;
  }
  return chars;
}

const userText = (() => {
  const challenge = store.currentChallenge;
  const ut = store.submitResult?.segmented_text || store.practiceResult?.segmented_text || '';
  return ut && challenge ? buildDiff(challenge.standard_answer, ut, true) : [];
})();

const standardDisplay = (() => {
  const challenge = store.currentChallenge;
  const ut = store.submitResult?.segmented_text || store.practiceResult?.segmented_text || '';
  return ut && challenge ? buildDiff(challenge.standard_answer, ut, false) : [];
})();
</script>

<template>
  <div class="space-y-3" v-if="store.currentChallenge">
    <div class="card p-4 stagger-1" v-if="standardDisplay.length">
      <h3 class="text-11px font-bold text-green-400 uppercase tracking-wider mb-2">标准答案</h3>
      <p class="text-lg leading-loose tracking-wider"><span v-for="(item,i) in standardDisplay" :key="i" :class="typeClass(item.type)">{{ item.char }}</span></p>
    </div>
    <div class="card p-4 stagger-2" v-if="userText.length">
      <h3 class="text-11px font-bold text-ph-gold uppercase tracking-wider mb-2">你的答案</h3>
      <p class="text-lg leading-loose tracking-wider"><span v-for="(item,i) in userText" :key="i" :class="typeClass(item.type)">{{ item.char }}</span></p>
      <div class="flex flex-wrap gap-2 mt-2 text-11px text-ph-muted">
        <span><span class="mark-correct">正确</span></span>
        <span><span class="mark-incorrect">错误</span></span>
        <span><span class="mark-extra">多余</span></span>
        <span><span class="mark-missing">⌖缺失</span></span>
      </div>
    </div>
    <div class="stagger-3"><ModelResultList /></div>
    <div class="card p-4 stagger-4" v-if="store.submissions.length">
      <h3 class="text-11px font-bold text-ph-muted uppercase tracking-wider mb-2 flex items-center gap-1"><Users class="w-3 h-3" />社区</h3>
      <div class="space-y-1.5">
        <div v-for="s in store.submissions.slice(0,5)" :key="s.public_id" class="flex justify-between items-center text-11px p-2 bg-ph-black">
          <span class="truncate flex-1 text-ph-text">{{ s.user_nickname||'匿名' }}：{{ s.segmented_text }}</span>
          <span class="font-bold font-mono text-ph-gold ml-2 whitespace-nowrap">{{ s.score_total }}分</span>
        </div>
      </div>
    </div>
  </div>
</template>
