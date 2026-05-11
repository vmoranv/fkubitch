<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '@/composables/useApi';
import type { Challenge } from '@/types';
import ChallengeCard from '@/components/ChallengeCard.vue';
import { Search } from 'lucide-vue-next';

const router = useRouter();
const challenges = ref<Challenge[]>([]);
const total = ref(0);
const loading = ref(true);
const page = ref(1);
const difficulty = ref('');
const tagFilter = ref('');

async function load() {
  loading.value = true;
  const p = new URLSearchParams({ page: String(page.value), limit: '24' });
  if (difficulty.value) p.set('difficulty', difficulty.value);
  if (tagFilter.value) p.set('tag', tagFilter.value);
  const r = await useApi<{ items: Challenge[]; total: number }>(`/challenges?${p}`);
  challenges.value = r.success ? r.data?.items || [] : [];
  total.value = r.success ? r.data?.total || 0 : 0;
  loading.value = false;
}
onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-black flex items-center gap-2 stagger-1"><Search class="w-5 h-5 text-ph-gold" />题库</h1>
    <div class="flex gap-2 stagger-2">
      <select v-model="difficulty" @change="page=1;load()" class="input w-auto text-11px">
        <option value="">全部难度</option><option value="1">★</option><option value="2">★★</option><option value="3">★★★</option><option value="4">★★★★</option><option value="5">★★★★★</option>
      </select>
      <input v-model="tagFilter" @change="page=1;load()" placeholder="搜索标签..." class="input w-40 text-11px" />
    </div>

    <div v-if="loading" class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      <div v-for="i in 8" :key="i" class="skeleton h-40" />
    </div>
    <div v-else-if="challenges.length===0" class="card p-6 text-center text-xs text-ph-muted">暂无挑战</div>
    <div v-else class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      <div v-for="(c,i) in challenges" :key="c.id" :class="`stagger-${Math.min(i+3,6)}`">
        <ChallengeCard :challenge="c" @click="router.push(`/challenge/${c.slug}`)" />
      </div>
    </div>

    <div v-if="total>24" class="flex justify-center gap-3 pt-2">
      <button :disabled="page<=1" @click="page--;load()" class="btn-ghost text-11px">上一页</button>
      <span class="py-2 text-11px text-ph-muted font-mono">{{ page }} / {{ Math.ceil(total/24) }}</span>
      <button :disabled="page>=Math.ceil(total/24)" @click="page++;load()" class="btn-ghost text-11px">下一页</button>
    </div>
  </div>
</template>
