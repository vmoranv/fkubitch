<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '@/composables/useApi';
import type { Challenge } from '@/types';
import { ArrowRight, Trophy, FlaskConical } from 'lucide-vue-next';

const router = useRouter();
const dailyChallenge = ref<Challenge | null>(null);
const challenges = ref<Challenge[]>([]);
const loading = ref(true);

onMounted(async () => {
  const [dailyRes, listRes] = await Promise.all([
    useApi<Challenge>('/challenges/daily'),
    useApi<{ items: Challenge[] }>('/challenges?limit=24'),
  ]);
  dailyChallenge.value = dailyRes.success ? dailyRes.data || null : null;
  challenges.value = listRes.success ? listRes.data?.items || [] : [];
  loading.value = false;
});

function goToChallenge(slug: string) { router.push(`/challenge/${slug}`); }
</script>

<template>
  <div class="space-y-6">
    <!-- Hero -->
    <section class="py-8 sm:py-12 stagger-1">
      <h1 class="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-tight">
        最权威的<span class="text-ph-gold">中文</span><br /><span class="text-ph-gold">benchmark</span>
      </h1>
      <p class="text-sm text-ph-muted mt-2">AI 模型中文理解能力终极评测平台</p>
      <div class="flex gap-2 mt-4">
        <button v-if="dailyChallenge" class="btn-primary text-sm px-6 py-3" @click="goToChallenge(dailyChallenge.slug)">
          <FlaskConical class="w-4 h-4" />
          今日挑战
        </button>
        <button class="btn-outline text-sm px-6 py-3" @click="router.push('/leaderboard')">
          <Trophy class="w-4 h-4" />
          排行榜
        </button>
      </div>
    </section>

    <!-- Loading -->
    <div v-if="loading" class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      <div v-for="i in 8" :key="i" class="skeleton h-40" />
    </div>

    <!-- Challenge Grid (Pornhub-style thumbnails) -->
    <section v-else class="stagger-2">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs font-bold text-ph-muted uppercase tracking-widest">挑战</h2>
        <router-link to="/challenges" class="text-11px text-ph-gold font-bold hover:underline flex items-center gap-1">
          全部 <ArrowRight class="w-3 h-3" />
        </router-link>
      </div>

      <div class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <div
          v-for="c in challenges"
          :key="c.id"
          class="card-hover cursor-pointer group"
          @click="goToChallenge(c.slug)"
        >
          <!-- Thumbnail area -->
          <div class="aspect-video bg-ph-surface flex items-center justify-center p-4 relative overflow-hidden">
            <p class="text-xl sm:text-2xl font-black text-center leading-snug tracking-tight group-hover:text-ph-gold transition-colors">
              {{ c.raw_text.slice(0, 20) }}{{ c.raw_text.length > 20 ? '…' : '' }}
            </p>
            <div class="absolute bottom-1.5 right-1.5 bg-ph-black/80 text-ph-muted text-11px font-bold px-1.5 py-0.5 font-mono">
              {{ c.play_count }} 次
            </div>
          </div>
          <!-- Info bar -->
          <div class="px-2.5 py-2 flex items-center text-11px text-ph-muted">
            <span class="font-bold text-ph-text truncate flex-1">{{ c.raw_text.slice(0, 12) }}{{ c.raw_text.length > 12 ? '…' : '' }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Leaderboard preview -->
    <section class="stagger-3">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs font-bold text-ph-muted uppercase tracking-widest">排行榜</h2>
        <router-link to="/leaderboard" class="text-11px text-ph-gold font-bold hover:underline flex items-center gap-1">
          全部 <ArrowRight class="w-3 h-3" />
        </router-link>
      </div>
      <div class="card p-3">
        <p class="text-xs text-ph-muted text-center py-6">登录后查看排名</p>
      </div>
    </section>
  </div>
</template>
