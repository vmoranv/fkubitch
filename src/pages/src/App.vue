<script setup lang="ts">
import AppHeader from './components/AppHeader.vue';
import LoginModal from './components/LoginModal.vue';
import { useAuthStore } from './stores/auth';
const auth = useAuthStore();
</script>

<template>
  <div class="min-h-[100dvh] flex flex-col bg-ph-black text-ph-text">
    <AppHeader />
    <main class="flex-1 w-full container-main py-8 sm:py-12 flex flex-col items-center">
      <router-view v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </router-view>
    </main>
    <footer class="text-center py-4 text-11px text-ph-muted border-t border-ph-border mt-auto">
      <p>© 2026 fuckubitch</p>
    </footer>
    <LoginModal v-if="auth.showLoginModal" />
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active { transition: opacity 0.15s ease; }
.page-enter-from { opacity: 0; transform: translateY(6px); }
.page-leave-to { opacity: 0; transform: translateY(-6px); }
.modal-enter-active,
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }
</style>
