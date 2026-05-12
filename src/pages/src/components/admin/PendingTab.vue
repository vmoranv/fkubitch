<script setup lang="ts">
import { ref } from 'vue';
import { useApi } from '@/composables/useApi';
import type { Challenge } from '@/types';
import { CheckCircle, XCircle } from 'lucide-vue-next';

const pending = ref<Challenge[]>([]);
const loading = ref(false);

const emit = defineEmits<{ reload: [] }>();

async function load() {
  loading.value = true;
  const r = await useApi<Challenge[]>('/admin/pending');
  pending.value = r.success ? r.data || [] : [];
  loading.value = false;
}

async function approve(slug: string) {
  const r = await useApi(`/admin/challenges/${slug}/approve`, { method: 'PUT' });
  if (r.success) { load(); emit('reload'); }
}

async function reject(slug: string) {
  if (!confirm(`拒绝 ${slug}?`)) return;
  const r = await useApi(`/admin/challenges/${slug}/reject`, { method: 'PUT' });
  if (r.success) load();
}

defineExpose({ load, pending });
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm font-bold text-ph-muted">{{ pending.length }} 条待审核</h2>
      <button @click="load" class="btn-ghost text-11px">刷新</button>
    </div>
    <div v-if="loading" class="space-y-2"><div v-for="i in 2" :key="i" class="skeleton h-24" /></div>
    <div v-else-if="pending.length === 0" class="text-center py-12 text-ph-muted text-xs">
      <CheckCircle class="w-8 h-8 mx-auto mb-2 opacity-20" />
      <p>没有待审核的挑战</p>
    </div>
    <div v-else class="space-y-2">
      <div v-for="p in pending" :key="p.slug" class="bg-ph-surface border border-ph-border rounded-lg p-4 space-y-3">
        <div>
          <p class="text-sm font-bold text-ph-text leading-relaxed">{{ p.raw_text }}</p>
          <p class="text-10px text-ph-muted mt-1">by {{ (p as any).submitted_by_name || '未知' }} / {{ p.slug }}</p>
        </div>
        <div class="text-10px text-ph-muted bg-ph-black rounded p-2 font-mono break-all">{{ p.answer_key_json }}</div>
        <div class="flex gap-2">
          <button @click="approve(p.slug)" class="btn-primary text-11px"><CheckCircle class="w-3 h-3" /> 通过</button>
          <button @click="reject(p.slug)" class="btn-ghost text-11px text-red-400"><XCircle class="w-3 h-3" /> 拒绝</button>
        </div>
      </div>
    </div>
  </div>
</template>
