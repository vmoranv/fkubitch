<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { Loader2 } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const { handleCallback } = useAuth();

onMounted(async () => {
  const params = new URLSearchParams(window.location.hash.replace('#', '?'));
  const token = params.get('access_token') || route.query.access_token as string;
  const refresh = params.get('refresh_token') || route.query.refresh_token as string;
  if (token && refresh) { await handleCallback(token, refresh); router.push('/'); }
  else { router.push('/?error=auth_failed'); }
});
</script>

<template>
  <div class="flex items-center justify-center py-20">
    <Loader2 class="w-6 h-6 text-ph-gold animate-spin" />
    <span class="ml-2 text-sm text-ph-muted">正在完成登录...</span>
  </div>
</template>
