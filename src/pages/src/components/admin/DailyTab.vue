<script setup lang="ts">
import { ref, computed } from 'vue';
import { useApi } from '@/composables/useApi';
import ChallengeCard from '@/components/ChallengeCard.vue';
import type { Challenge } from '@/types';
import { Calendar } from 'lucide-vue-next';

const props = defineProps<{ challenges: Challenge[] }>();

const publishedChallenges = computed(() => props.challenges.filter(c => c.status === 'published'));

const dailySlug = ref('');
const dailyDate = ref(new Date().toISOString().split('T')[0]);
const dailyMsg = ref('');

async function setDaily() {
  const r = await useApi('/admin/daily-challenge', {
    method: 'POST',
    body: JSON.stringify({ challenge_slug: dailySlug.value, date: dailyDate.value }),
  });
  dailyMsg.value = r.success ? `已设置 ${dailyDate.value}` : (r.error || '设置失败');
  setTimeout(() => dailyMsg.value = '', 3000);
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h3 class="text-10px text-ph-muted uppercase tracking-wider mb-2">选择挑战</h3>
      <div v-if="challenges.length === 0" class="text-xs text-ph-muted py-4">暂无已发布的挑战</div>
      <div v-else class="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <div v-for="c in publishedChallenges" :key="c.slug" @click="dailySlug = c.slug"
          :class="['rounded-lg border cursor-pointer transition-all duration-150',
            dailySlug === c.slug ? 'border-ph-gold shadow-[0_0_0_1px_#f90]' : 'border-transparent hover:border-ph-border']">
          <ChallengeCard :challenge="c" />
        </div>
      </div>
    </div>
    <div v-if="dailySlug" class="bg-ph-surface border border-ph-border rounded-lg p-4 space-y-3">
      <p class="text-xs text-ph-text font-bold truncate">{{ challenges.find(c => c.slug === dailySlug)?.raw_text }}</p>
      <div class="flex items-end gap-3">
        <div class="flex-1">
          <label class="text-10px text-ph-muted uppercase tracking-wider block mb-1">日期</label>
          <input v-model="dailyDate" type="date" class="input" />
        </div>
        <button @click="setDaily" class="btn-primary text-11px shrink-0"><Calendar class="w-3 h-3" /> 设置</button>
      </div>
      <p v-if="dailyMsg" class="text-11px" :class="dailyMsg.includes('已设置') ? 'text-green-400' : 'text-red-400'">{{ dailyMsg }}</p>
    </div>
  </div>
</template>
