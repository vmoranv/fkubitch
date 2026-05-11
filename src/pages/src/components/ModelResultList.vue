<script setup lang="ts">
import { useChallengeStore } from '@/stores/challenge';
import { Cpu } from 'lucide-vue-next';
const store = useChallengeStore();
</script>

<template>
  <div v-if="store.modelResults.length" class="card p-4">
    <h3 class="text-11px font-bold text-ph-muted uppercase tracking-wider mb-2 flex items-center gap-1"><Cpu class="w-3 h-3" />AI 对比</h3>
    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="mr in store.modelResults" :key="mr.id" class="bg-ph-black p-3 text-11px border border-ph-border/30 hover:border-ph-gold/15 transition-colors">
        <div class="flex items-center justify-between mb-1.5"><span class="font-bold text-ph-text uppercase">{{ mr.provider }}</span><span class="text-ph-muted/60">{{ mr.model_name }}</span></div>
        <p class="text-ph-text/70 leading-relaxed mb-1.5">{{ mr.segmented_text }}</p>
        <div class="flex gap-2"><span class="font-bold font-mono text-ph-gold">{{ mr.score_total }}</span><span class="text-ph-muted/40">E{{ mr.score_edit }} P{{ mr.score_punctuation }}</span></div>
      </div>
    </div>
  </div>
</template>
