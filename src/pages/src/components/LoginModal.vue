<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import { useAuth } from '@/composables/useAuth';
import { Github, Chrome } from 'lucide-vue-next';
const auth = useAuthStore();
const { loginGitHub, loginGoogle } = useAuth();
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-100 flex items-center justify-center bg-black/80 p-4" @click.self="auth.closeLogin()">
      <div class="bg-ph-card border border-ph-border w-full max-w-sm p-6">
        <h2 class="text-sm font-black uppercase tracking-wider text-center mb-1">登录</h2>
        <p class="text-11px text-ph-muted text-center mb-4">选择一种方式登录，积分永久保存</p>
        <div class="space-y-2">
          <button v-if="auth.providers.github" @click="loginGitHub" class="w-full btn border border-ph-border hover:border-ph-gold/40 hover:bg-ph-surface flex items-center justify-center gap-2 py-3 text-ph-text text-xs font-bold uppercase tracking-wider">
            <Github class="w-4 h-4" /> GitHub
          </button>
          <button v-if="auth.providers.google" @click="loginGoogle" class="w-full btn border border-ph-border hover:border-ph-gold/40 hover:bg-ph-surface flex items-center justify-center gap-2 py-3 text-ph-text text-xs font-bold uppercase tracking-wider">
            <Chrome class="w-4 h-4" /> Google
          </button>
          <p v-if="!auth.providers.github && !auth.providers.google" class="text-11px text-ph-muted text-center py-4">暂无可用的登录方式</p>
        </div>
        <button @click="auth.closeLogin()" class="btn-ghost w-full mt-3 text-11px uppercase tracking-wider">游客模式</button>
      </div>
    </div>
  </Teleport>
</template>
