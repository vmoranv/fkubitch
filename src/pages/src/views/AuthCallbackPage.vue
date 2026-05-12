<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { Loader2 } from 'lucide-vue-next';


const router = useRouter();
const { handleCallback } = useAuth();

onMounted(async () => {
  const hash = window.location.hash.replace('#', '');
  const qs = hash.includes('?') ? hash.split('?')[1] : '';
  const params = new URLSearchParams(qs);
  const token = params.get('access_token');
  const refresh = params.get('refresh_token');
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
