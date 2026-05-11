<script setup lang="ts">
import type { Challenge } from '@/types';
defineProps<{ challenge: Challenge }>();
</script>

<template>
  <div class="card-hover cursor-pointer group">
    <div class="aspect-video bg-ph-surface flex items-center justify-center p-4 relative overflow-hidden">
      <p class="text-xl sm:text-2xl font-black text-center leading-snug tracking-tight group-hover:text-ph-gold transition-colors">
        {{ challenge.raw_text.slice(0, 20) }}{{ challenge.raw_text.length > 20 ? '…' : '' }}
      </p>
      <div class="absolute bottom-1.5 right-1.5 bg-ph-black/80 text-ph-muted text-11px font-bold px-1.5 py-0.5 font-mono">
        {{ challenge.play_count }} 次
      </div>
    </div>
    <div class="px-2.5 py-2 flex items-center text-11px text-ph-muted">
      <span class="font-bold text-ph-text truncate flex-1">{{ challenge.raw_text.slice(0, 12) }}{{ challenge.raw_text.length > 12 ? '…' : '' }}</span>
    </div>
  </div>
</template>
