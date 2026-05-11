<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '@/composables/useApi';
import type { LeaderboardEntry } from '@/types';
import LeaderboardTable from '@/components/LeaderboardTable.vue';
import { Trophy } from 'lucide-vue-next';

const period = ref<'all' | 'weekly' | 'daily'>('all');
const entries = ref<LeaderboardEntry[]>([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  const r = await useApi<LeaderboardEntry[]>(`/leaderboard?period=${period.value}&limit=50`);
  entries.value = r.success ? r.data || [] : [];
  loading.value = false;
}
onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-black flex items-center gap-2 stagger-1"><Trophy class="w-5 h-5 text-ph-gold" />排行榜</h1>
    <div class="flex gap-1 stagger-2">
      <button v-for="p in [{k:'all',l:'总榜'},{k:'weekly',l:'周榜'},{k:'daily',l:'日榜'}] as const" :key="p.k"
        :class="period===p.k?'btn-primary text-11px':'btn-ghost text-11px'" @click="period=p.k;load()">{{ p.l }}</button>
    </div>
    <div class="stagger-3"><LeaderboardTable :entries="entries" :loading="loading" /></div>
  </div>
</template>
