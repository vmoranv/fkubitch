import { useAuthStore } from '@/stores/auth';
import { useApi } from './useApi';
import type { User } from '@/types';

export function useAuth() {
  const auth = useAuthStore();

  async function loginGitHub() {
    auth.closeLogin();
    window.location.href = '/api/auth/github/start';
  }

  async function loginGoogle() {
    auth.closeLogin();
    window.location.href = '/api/auth/google/start';
  }

  async function handleCallback(token: string, refreshToken: string) {
    auth.setTokens(token, refreshToken);
    const result = await useApi<User>('/users/me');
    if (result.success && result.data) {
      auth.setUser(result.data);
      auth.closeLogin();
    }
  }

  async function logout() {
    await useApi('/auth/logout', { method: 'POST' });
    auth.logout();
  }

  async function fetchUser() {
    const result = await useApi<User>('/users/me');
    if (result.success && result.data) {
      auth.setUser(result.data);
    }
  }

  return { loginGitHub, loginGoogle, handleCallback, logout, fetchUser };
}
