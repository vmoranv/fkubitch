import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import { routes } from './router';
import 'virtual:uno.css';
import './styles/main.css';

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
app.use(router);

app.mount('#app');
