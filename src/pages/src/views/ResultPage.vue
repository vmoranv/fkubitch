<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useChallengeStore } from '@/stores/challenge';
import { useSegment } from '@/composables/useSegment';
import ScoreCard from '@/components/ScoreCard.vue';
import ComparisonView from '@/components/ComparisonView.vue';
import { RotateCcw, Home } from 'lucide-vue-next';

const route = useRoute();
const store = useChallengeStore();
const { loadChallengeDetails, loadChallengeSubmissions } = useSegment();
const loading = ref(true);

onMounted(async () => {
  const slug = route.params.slug as string;
  await loadChallengeDetails(slug);
  await Promise.all([loadChallengeSubmissions(slug)]);
  loading.value = false;
});
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="space-y-3"><div class="skeleton h-8 w-48" /><div class="skeleton h-28 w-full" /><div class="skeleton h-28 w-full" /></div>
    <template v-else-if="store.currentChallenge">
      <div class="text-center stagger-1"><p class="text-11px text-ph-muted">挑战：{{ store.currentChallenge.raw_text }}</p></div>
      <div class="stagger-2" v-if="store.practiceResult || store.submitResult">
        <ScoreCard :score="store.submitResult || store.practiceResult!" :mode="store.submitResult ? 'submit' : 'practice'" />
      </div>
      <ComparisonView />
      <div class="flex justify-center gap-3 pt-3 stagger-5">
        <router-link :to="`/challenge/${route.params.slug}`" class="btn-primary text-11px"><RotateCcw class="w-3.5 h-3.5" />再试一次</router-link>
        <router-link to="/" class="btn-ghost text-11px"><Home class="w-3.5 h-3.5" />首页</router-link>
      </div>
    </template>
    <div v-else class="text-center py-12 text-ph-muted text-xs">加载中...</div>
  </div>
</template>
