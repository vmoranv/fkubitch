<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useChallengeStore } from '@/stores/challenge';
import { useSegment } from '@/composables/useSegment';
import PunctuationToolbar from '@/components/PunctuationToolbar.vue';
import { AlertCircle } from 'lucide-vue-next';

const route = useRoute();
const store = useChallengeStore();
const loading = ref(true);
const error = ref('');
const { loadChallengeDetails, loadChallengeSubmissions } = useSegment();

async function init(slug: string) {
  loading.value = true; error.value = '';
  const c = await loadChallengeDetails(slug);
  if (!c) { error.value = '挑战不存在'; }
  else { await loadChallengeSubmissions(slug); }
  loading.value = false;
}
onMounted(() => init(route.params.slug as string));
watch(() => route.params.slug, (s) => init(s as string));
</script>

<template>
  <div class="w-full space-y-6">
    <!-- Mobile rotate hint -->
    <p class="text-11px text-ph-muted text-center sm:hidden">📱 请横屏以获得更好体验</p>
    <div v-if="loading" class="space-y-3 w-full">
      <div class="skeleton h-12 w-3/4 mx-auto" />
      <div class="skeleton h-48 w-full" />
    </div>
    <div v-else-if="error" class="text-center py-12">
      <AlertCircle class="w-10 h-10 mx-auto mb-2 text-ph-muted/30" />
      <p class="text-sm text-ph-muted mb-3">{{ error }}</p>
      <router-link to="/" class="btn-primary text-11px">返回首页</router-link>
    </div>
    <template v-else-if="store.currentChallenge">
      <PunctuationToolbar />
    </template>
  </div>
</template>
