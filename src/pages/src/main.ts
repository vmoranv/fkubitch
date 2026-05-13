import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import { routes } from './router';
import { useAuthStore } from './stores/auth';
import { useApi } from './composables/useApi';
import 'virtual:uno.css';
import './styles/main.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// Auto-restore user profile on app load
const auth = useAuthStore();
if (auth.accessToken && !auth.user) {
  useApi('/users/me').then(r => {
    if (r.success && r.data) auth.setUser(r.data as any);
  });
}

// Load enabled OAuth providers (cached at edge for 1h)
useApi<{ github: boolean; google: boolean }>('/auth/config').then(r => {
  if (r.success && r.data) auth.setProviders(r.data);
});

// Navigation guard: guest can't access meta.guest:false routes, admin routes require role
router.beforeEach((to, from) => {
  const auth = useAuthStore();
  if (to.meta.guest === false && auth.isGuest) {
    auth.openLogin();
    return from.path || '/';
  }
  if (to.meta.admin && auth.user?.role !== 'admin') {
    return '/';
  }
});

app.use(router);
app.mount('#app');
