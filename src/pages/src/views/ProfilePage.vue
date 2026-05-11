<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useAuthStore } from '@/stores/auth';
import { useApi } from '@/composables/useApi';
import type { User, Submission } from '@/types';
import { User as UserIcon, LogOut, FileText, Star } from 'lucide-vue-next';

const router = useRouter();
const auth = useAuthStore();
const { logout } = useAuth();
const profile = ref<User | null>(null);
const history = ref<Array<Submission & { challenge_slug: string; challenge_raw_text: string }>>([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  if (!auth.isLoggedIn) { auth.openLogin(); router.push('/'); return; }
  const r = await useApi<User>('/users/me');
  if (r.success && r.data) {
    profile.value = r.data;
    const h = await useApi<{ items: Array<Submission & { challenge_slug: string; challenge_raw_text: string }> }>('/users/me/history?limit=20');
    if (h.success && h.data) history.value = h.data.items;
  } else { error.value = r.error || '加载失败'; }
  loading.value = false;
});

async function handleLogout() { await logout(); router.push('/'); }
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-black flex items-center gap-2 stagger-1"><UserIcon class="w-5 h-5 text-ph-gold" />个人中心</h1>

    <div v-if="loading" class="space-y-3"><div class="skeleton h-36" /><div class="skeleton h-48" /></div>
    <div v-else-if="error" class="card p-6 text-center"><p class="text-xs text-ph-muted">{{ error }}</p><button @click="router.push('/')" class="btn-primary text-11px mt-3">返回首页</button></div>

    <template v-else-if="profile">
      <div class="card p-4 stagger-2">
        <div class="flex items-center gap-3">
          <img v-if="profile.avatar_url" :src="profile.avatar_url" class="w-14 h-14 rounded" alt="" />
          <div v-else class="w-14 h-14 rounded bg-ph-surface border border-ph-border flex items-center justify-center"><UserIcon class="w-6 h-6 text-ph-muted" /></div>
          <div>
            <h2 class="text-lg font-black text-ph-text">{{ profile.nickname }}</h2>
            <p class="text-11px text-ph-muted">排名 <span class="font-mono text-ph-gold font-bold">#{{ profile.rank || '-' }}</span></p>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3 mt-4 text-center">
          <div class="bg-ph-black p-2.5"><p class="text-xl font-black font-mono text-ph-gold">{{ profile.total_score }}</p><p class="text-11px text-ph-muted mt-0.5">积分</p></div>
          <div class="bg-ph-black p-2.5"><p class="text-xl font-black font-mono text-ph-gold">{{ profile.solved_count || 0 }}</p><p class="text-11px text-ph-muted mt-0.5">挑战</p></div>
          <div class="bg-ph-black p-2.5"><p class="text-xl font-black font-mono text-ph-gold">{{ history.length }}</p><p class="text-11px text-ph-muted mt-0.5">提交</p></div>
        </div>
        <button @click="handleLogout" class="btn-outline w-full mt-3 text-11px"><LogOut class="w-3 h-3" />退出登录</button>
      </div>

      <div class="stagger-3">
        <h3 class="text-11px font-bold text-ph-muted uppercase tracking-wider mb-2 flex items-center gap-1"><FileText class="w-3 h-3" />历史</h3>
        <div v-if="history.length===0" class="card p-6 text-center text-11px text-ph-muted"><Star class="w-6 h-6 mx-auto mb-1 opacity-20" /><p>暂无记录</p></div>
        <div v-else class="space-y-2">
          <div v-for="h in history.slice(0,10)" :key="h.public_id" class="card-hover p-3 cursor-pointer" @click="router.push(`/challenge/${h.challenge_slug}`)">
            <div class="flex justify-between items-center">
              <div class="flex-1 min-w-0"><p class="text-xs font-bold text-ph-text truncate">{{ h.challenge_raw_text }}</p><p class="text-11px text-ph-muted mt-1">{{ new Date(h.created_at).toLocaleDateString('zh-CN') }}</p></div>
              <div class="ml-3 text-right"><p class="font-black font-mono text-ph-gold">{{ h.score_total }}</p><p class="text-11px text-ph-muted">分</p></div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
