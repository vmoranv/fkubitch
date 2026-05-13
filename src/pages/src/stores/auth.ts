import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User } from '@/types';

const GUEST_ID_KEY = 'dj_guest_id';
const ACCESS_TOKEN_KEY = 'dj_access_token';
const REFRESH_TOKEN_KEY = 'dj_refresh_token';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
  const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY));
  const showLoginModal = ref(false);
  const providers = ref<{ github: boolean; google: boolean }>({ github: false, google: false });

  const isGuest = computed(() => !user.value && !accessToken.value);
  const isLoggedIn = computed(() => !!user.value || !!accessToken.value);
  const guestId = computed(() => {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = 'guest_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  });

  function setTokens(access: string, refresh: string) {
    accessToken.value = access;
    refreshToken.value = refresh;
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }

  function clearTokens() {
    accessToken.value = null;
    refreshToken.value = null;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  function setUser(u: User) {
    user.value = u;
  }

  function setProviders(p: { github: boolean; google: boolean }) {
    providers.value = p;
  }

  function logout() {
    user.value = null;
    clearTokens();
  }

  function openLogin() {
    showLoginModal.value = true;
  }

  function closeLogin() {
    showLoginModal.value = false;
  }

  return {
    user,
    accessToken,
    refreshToken,
    showLoginModal,
    providers,
    isGuest,
    isLoggedIn,
    guestId,
    setTokens,
    clearTokens,
    setUser,
    setProviders,
    logout,
    openLogin,
    closeLogin,
  };
});
