<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '@/composables/useApi';
import { useAuthStore } from '@/stores/auth';
import type { Challenge } from '@/types';
import ChallengeCard from '@/components/ChallengeCard.vue';
import { Search, Plus, X, SendHorizonal } from 'lucide-vue-next';

const router = useRouter();
const auth = useAuthStore();
const challenges = ref<Challenge[]>([]);
const total = ref(0);
const loading = ref(true);
const page = ref(1);

// Submit form
const showSubmit = ref(false);
const submitForm = ref({ raw_text: '', answer_key_json: '{"positions":[]}' });
const submitMsg = ref('');
const submitLoading = ref(false);

async function load() {
  loading.value = true;
  const p = new URLSearchParams({ page: String(page.value), limit: '24' });
  const r = await useApi<{ items: Challenge[]; total: number }>(`/challenges?${p}`);
  challenges.value = r.success ? r.data?.items || [] : [];
  total.value = r.success ? r.data?.total || 0 : 0;
  loading.value = false;
}

async function submitChallenge() {
  submitLoading.value = true;
  const r = await useApi<{ slug: string; status: string }>('/challenges/submit', {
    method: 'POST',
    body: JSON.stringify(submitForm.value),
  });
  if (r.success) {
    const status = r.data!.status;
    submitMsg.value = status === 'pending' ? '已提交，等待审核' : '已发布';
    showSubmit.value = false;
    submitForm.value = { raw_text: '', answer_key_json: '{"positions":[]}' };
    load();
  } else {
    submitMsg.value = r.error || '提交失败';
  }
  submitLoading.value = false;
  setTimeout(() => submitMsg.value = '', 4000);
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between stagger-1">
      <h1 class="text-xl font-black flex items-center gap-2"><Search class="w-5 h-5 text-ph-gold" />题库</h1>
      <button v-if="auth.isLoggedIn" @click="showSubmit = !showSubmit" class="btn-outline text-11px">
        <Plus class="w-3.5 h-3.5" /> 出题
      </button>
    </div>

    <!-- Submit form -->
    <div v-if="showSubmit" class="bg-ph-surface border border-ph-border rounded-lg p-4 space-y-3 stagger-2">
      <div class="flex items-center justify-between">
        <h3 class="text-11px font-bold uppercase tracking-wider text-ph-muted">提交新挑战</h3>
        <button @click="showSubmit = false" class="btn-ghost text-11px px-1"><X class="w-3 h-3" /></button>
      </div>
      <div>
        <label class="text-10px text-ph-muted uppercase tracking-wider block mb-1">原始文本</label>
        <textarea v-model="submitForm.raw_text" placeholder="输入一句中文..." class="input h-16 resize-y" />
      </div>
      <div>
        <label class="text-10px text-ph-muted uppercase tracking-wider block mb-1">正确分割位置 (JSON)</label>
        <input v-model="submitForm.answer_key_json" placeholder='{"positions":[3,8,12]}' class="input font-mono text-11px" />
        <p class="text-10px text-ph-muted mt-1">positions 为字符索引，从 0 开始</p>
      </div>
      <button @click="submitChallenge" :disabled="submitLoading" class="btn-primary text-11px">
        <SendHorizonal class="w-3 h-3" /> 提交
      </button>
      <p v-if="submitMsg" class="text-11px" :class="submitMsg.includes('已') ? 'text-green-400' : 'text-red-400'">{{ submitMsg }}</p>
    </div>

    <!-- Grid -->
    <div v-if="loading" class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      <div v-for="i in 8" :key="i" class="skeleton h-40" />
    </div>
    <div v-else-if="challenges.length===0" class="card p-6 text-center text-xs text-ph-muted">暂无挑战</div>
    <div v-else class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      <div v-for="(c,i) in challenges" :key="c.id" :class="`stagger-${Math.min(i+3,6)}`">
        <ChallengeCard :challenge="c" @click="router.push(`/challenge/${c.slug}`)" />
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="total>24" class="flex justify-center gap-3 pt-2">
      <button :disabled="page<=1" @click="page--;load()" class="btn-ghost text-11px">上一页</button>
      <span class="py-2 text-11px text-ph-muted font-mono">{{ page }} / {{ Math.ceil(total/24) }}</span>
      <button :disabled="page>=Math.ceil(total/24)" @click="page++;load()" class="btn-ghost text-11px">下一页</button>
    </div>
  </div>
</template>
