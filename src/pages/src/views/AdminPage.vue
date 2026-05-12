<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '@/composables/useApi';
import type { Challenge } from '@/types';
import ChallengesTab from '@/components/admin/ChallengesTab.vue';
import PendingTab from '@/components/admin/PendingTab.vue';
import ModelsTab from '@/components/admin/ModelsTab.vue';
import DailyTab from '@/components/admin/DailyTab.vue';
import { Clock } from 'lucide-vue-next';

const tab = ref<'challenges' | 'pending' | 'models' | 'daily'>('challenges');
const challenges = ref<Challenge[]>([]);
const challengesLoading = ref(true);
const pendingRef = ref<InstanceType<typeof PendingTab> | null>(null);

async function loadChallenges() {
  challengesLoading.value = true;
  const r = await useApi<Challenge[]>('/admin/challenges');
  challenges.value = r.success ? r.data || [] : [];
  challengesLoading.value = false;
}

function reloadAll() {
  loadChallenges();
  pendingRef.value?.load();
}

onMounted(() => {
  loadChallenges();
  // PendingTab loads itself but we need the ref, so defer
  setTimeout(() => pendingRef.value?.load(), 0);
});
</script>

<template>
  <div class="max-w-3xl mx-auto w-full">
    <!-- Tabs -->
    <div class="flex gap-1 mb-5 stagger-1 overflow-x-auto pb-1">
      <button v-for="t in ([
        { k: 'challenges' as const, l: '挑战管理' },
        { k: 'pending' as const, l: '审核', badge: true },
        { k: 'models' as const, l: 'LLM 成绩' },
        { k: 'daily' as const, l: '每日挑战' },
      ])" :key="t.k"
        :class="tab === t.k ? 'btn-primary text-11px' : 'btn-ghost text-11px'"
        @click="tab = t.k"
      >
        <template v-if="t.badge">
          <Clock class="w-3 h-3" /> {{ t.l }}
          <span v-if="pendingRef?.pending?.length" class="ml-1 bg-ph-gold/20 text-ph-gold px-1.5 rounded font-mono text-10px">{{ pendingRef.pending.length }}</span>
        </template>
        <template v-else>{{ t.l }}</template>
      </button>
    </div>

    <ChallengesTab v-if="tab === 'challenges'" :challenges="challenges" :loading="challengesLoading" @reload="reloadAll" />
    <PendingTab v-if="tab === 'pending'" ref="pendingRef" @reload="loadChallenges" />
    <ModelsTab v-if="tab === 'models'" :challenges="challenges" />
    <DailyTab v-if="tab === 'daily'" :challenges="challenges" />
  </div>
</template>
