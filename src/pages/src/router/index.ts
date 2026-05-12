import type { RouteRecordRaw } from 'vue-router';
import HomePage from '@/views/HomePage.vue';

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomePage, meta: { guest: true } },
  {
    path: '/challenges',
    name: 'challenges',
    component: () => import('@/views/ChallengeListPage.vue'),
    meta: { guest: true },
  },
  {
    path: '/challenge/:slug',
    name: 'challenge',
    component: () => import('@/views/ChallengePage.vue'),
    meta: { guest: true },
  },
  {
    path: '/challenge/:slug/result/:submissionId?',
    name: 'result',
    component: () => import('@/views/ResultPage.vue'),
    meta: { guest: true },
  },
  {
    path: '/leaderboard',
    name: 'leaderboard',
    component: () => import('@/views/LeaderboardPage.vue'),
    meta: { guest: true },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfilePage.vue'),
    meta: { guest: false },
  },
  {
    path: '/auth/callback',
    name: 'authCallback',
    component: () => import('@/views/AuthCallbackPage.vue'),
    meta: { guest: true },
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/AdminPage.vue'),
    meta: { guest: false, admin: true },
  },
];
