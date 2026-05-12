<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useAuthStore } from '@/stores/auth';
import { useApi } from '@/composables/useApi';
import type { User, Submission } from '@/types';
import { User as UserIcon, LogOut, FileText, Star, ChevronRight } from 'lucide-vue-next';

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
  <div class="max-w-xl mx-auto w-full">
    <div v-if="loading" class="space-y-4 stagger-1">
      <div class="skeleton h-28" />
      <div class="skeleton h-20" />
      <div class="skeleton h-64" />
    </div>

    <div v-else-if="error" class="card p-8 text-center stagger-1">
      <p class="text-xs text-ph-muted">{{ error }}</p>
      <button @click="router.push('/')" class="btn-primary text-11px mt-4">返回首页</button>
    </div>

    <template v-else-if="profile">
      <!-- Profile header -->
      <div class="stagger-1 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div v-if="profile.avatar_url" class="w-16 h-16 rounded-lg overflow-hidden border border-ph-border shrink-0">
            <img :src="profile.avatar_url" class="w-full h-full object-cover" alt="" />
          </div>
          <div v-else class="w-16 h-16 rounded-lg bg-ph-surface border border-ph-border flex items-center justify-center shrink-0">
            <UserIcon class="w-7 h-7 text-ph-muted" />
          </div>
          <div>
            <h1 class="text-lg font-black text-ph-text leading-tight">{{ profile.nickname }}</h1>
            <p class="text-11px text-ph-muted mt-1 flex items-center gap-1">
              <Trophy class="w-3 h-3 text-ph-gold" />
              排名 <span class="font-mono text-ph-gold font-bold">#{{ profile.rank || '-' }}</span>
            </p>
          </div>
        </div>
        <button @click="handleLogout" class="btn-ghost text-11px text-ph-muted px-2">
          <LogOut class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-2 mt-5 stagger-2">
        <div class="bg-ph-surface border border-ph-border rounded-lg p-3 text-center">
          <p class="text-2xl font-black font-mono text-ph-gold leading-none">{{ profile.total_score }}</p>
          <p class="text-10px text-ph-muted mt-1.5 uppercase tracking-widest">积分</p>
        </div>
        <div class="bg-ph-surface border border-ph-border rounded-lg p-3 text-center">
          <p class="text-2xl font-black font-mono text-ph-gold leading-none">{{ profile.solved_count || 0 }}</p>
          <p class="text-10px text-ph-muted mt-1.5 uppercase tracking-widest">挑战</p>
        </div>
        <div class="bg-ph-surface border border-ph-border rounded-lg p-3 text-center">
          <p class="text-2xl font-black font-mono text-ph-gold leading-none">{{ history.length }}</p>
          <p class="text-10px text-ph-muted mt-1.5 uppercase tracking-widest">提交</p>
        </div>
      </div>

      <!-- History -->
      <div class="mt-6 stagger-3">
        <h3 class="text-11px font-bold text-ph-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <FileText class="w-3 h-3" />提交记录
        </h3>

        <div v-if="history.length === 0" class="bg-ph-surface border border-ph-border rounded-lg p-8 text-center">
          <Star class="w-8 h-8 mx-auto mb-2 text-ph-muted opacity-20" />
          <p class="text-xs text-ph-muted">暂无提交记录</p>
          <button @click="router.push('/challenges')" class="btn-outline text-11px mt-4">
            去挑战 <ChevronRight class="w-3 h-3" />
          </button>
        </div>

        <div v-else class="space-y-1.5">
          <div
            v-for="h in history.slice(0, 15)"
            :key="h.public_id"
            class="bg-ph-surface border border-ph-border rounded-lg px-4 py-3 cursor-pointer hover:border-ph-gold/30 transition-colors duration-200"
            @click="router.push(`/challenge/${h.challenge_slug}`)"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-ph-text truncate">{{ h.challenge_raw_text }}</p>
                <p class="text-10px text-ph-muted mt-1">{{ new Date(h.created_at).toLocaleDateString('zh-CN') }}</p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-sm font-black font-mono" :class="h.score_total >= 800 ? 'text-ph-gold' : h.score_total >= 500 ? 'text-ph-text' : 'text-ph-muted'">
                  {{ h.score_total }}
                </p>
                <p class="text-10px text-ph-muted">分</p>
              </div>
              <ChevronRight class="w-3.5 h-3.5 text-ph-muted/40 shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
