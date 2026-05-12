<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAuth } from '@/composables/useAuth';
import { BookOpen, Trophy, LogIn, User, LogOut, Shield } from 'lucide-vue-next';

const router = useRouter();
const auth = useAuthStore();
const { logout } = useAuth();
</script>

<template>
  <header class="sticky top-0 z-50 bg-ph-black border-b border-ph-border">
    <div class="container-main h-12 flex items-center justify-between">
      <!-- Logo -->
      <router-link to="/" class="flex items-center gap-1.5 text-ph-gold hover:brightness-110 transition-all no-underline shrink-0">
        <span class="text-lg font-black tracking-tighter">fuckubitch</span>
        <span class="text-11px text-ph-muted font-normal tracking-normal hidden sm:inline">中文 benchmark</span>
      </router-link>

      <!-- Nav -->
      <nav class="flex items-center gap-0.5">
        <router-link to="/challenges" class="btn-ghost text-11px py-1.5 px-3">
          <BookOpen class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">题库</span>
        </router-link>
        <router-link to="/leaderboard" class="btn-ghost text-11px py-1.5 px-3">
          <Trophy class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">排行</span>
        </router-link>
        <template v-if="auth.isLoggedIn">
          <router-link v-if="auth.user?.role === 'admin'" to="/admin" class="btn-ghost text-11px py-1.5 px-3 text-ph-gold">
            <Shield class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">管理</span>
          </router-link>
          <router-link to="/profile" class="btn-ghost text-11px py-1.5 px-3 gap-2">
            <img v-if="auth.user?.avatar_url" :src="auth.user.avatar_url" class="w-5 h-5 rounded object-cover" alt="" />
            <User v-else class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ auth.user?.nickname }}</span>
          </router-link>
          <button @click="logout(); router.push('/')" class="btn-ghost text-11px py-1.5 px-2 text-ph-muted">
            <LogOut class="w-3.5 h-3.5" />
          </button>
        </template>
        <button v-else @click="auth.openLogin()" class="btn-primary text-11px py-1.5 px-4">
          <LogIn class="w-3.5 h-3.5" />
          登录
        </button>
      </nav>
    </div>
  </header>
</template>
