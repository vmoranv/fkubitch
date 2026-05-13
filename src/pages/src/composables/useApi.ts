import { useAuthStore } from '@/stores/auth';

const API_BASE = '/api';

export async function useApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const auth = useAuthStore();

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // Only attach Content-Type when there's a body — keeps GETs free of
  // unnecessary headers and avoids CORS preflights in cross-origin setups.
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth.accessToken) {
    headers['Authorization'] = `Bearer ${auth.accessToken}`;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${auth.accessToken}`;
        const retryRes = await fetch(`${API_BASE}${path}`, { ...options, headers });
        return retryRes.json();
      }
      auth.logout();
      return { success: false, error: '登录已过期，请重新登录' };
    }

    if (res.status === 429) {
      return { success: false, error: '请求太频繁，请稍后再试' };
    }

    return res.json();
  } catch {
    return { success: false, error: '网络错误，请检查连接' };
  }
}

async function tryRefresh(): Promise<boolean> {
  const auth = useAuthStore();
  if (!auth.refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Refresh-Token': auth.refreshToken,
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        auth.setTokens(json.data.access_token, json.data.refresh_token);
        return true;
      }
    }
  } catch {
    // ignore
  }

  return false;
}
