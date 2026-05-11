<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { ScoreData } from '@/types';

const props = defineProps<{ score: ScoreData; mode: 'practice' | 'submit' }>();
const animatedScore = ref(0);

onMounted(() => {
  const target = props.score.score_total;
  const start = performance.now();
  function tick(now: number) {
    const elapsed = now - start;
    const p = Math.min(elapsed / 600, 1);
    animatedScore.value = Math.round((1 - Math.pow(1 - p, 4)) * target);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
});
</script>

<template>
  <div class="card p-4 text-center relative overflow-hidden">
    <p class="text-11px text-ph-muted uppercase tracking-widest relative z-1">{{ mode === 'practice' ? '练习' : '正式成绩' }}</p>
    <p class="text-5xl font-black font-mono mt-1 relative z-1 text-ph-gold">{{ animatedScore }}</p>
    <div class="flex justify-center gap-5 mt-3 text-11px relative z-1">
      <div><span class="text-ph-muted">匹配 </span><span class="font-bold font-mono text-green-400">{{ (score as any).matched || 0 }}</span></div>
      <div><span class="text-ph-muted">多余 </span><span class="font-bold font-mono" :class="(score as any).extra > 1 ? 'text-red-400' : 'text-ph-gold'">{{ (score as any).extra || 0 }}</span></div>
      <div><span class="text-ph-muted">缺失 </span><span class="font-bold font-mono" :class="(score as any).missed > 0 ? 'text-red-400' : 'text-green-400'">{{ (score as any).missed || 0 }}</span></div>
    </div>
  </div>
</template>
