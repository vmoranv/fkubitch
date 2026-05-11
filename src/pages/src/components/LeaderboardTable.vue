<script setup lang="ts">
import type { LeaderboardEntry } from '@/types';
import { Medal, User } from 'lucide-vue-next';
defineProps<{ entries: LeaderboardEntry[]; loading: boolean }>();
</script>

<template>
  <div class="card">
    <div v-if="loading" class="space-y-2 p-3">
      <div v-for="i in 5" :key="i" class="skeleton h-8 w-full" />
    </div>
    <div v-else-if="entries.length === 0" class="text-center py-8 text-ph-muted text-xs font-bold uppercase tracking-wider">
      暂无数据
    </div>
    <table v-else class="w-full text-11px">
      <thead><tr class="border-b border-ph-border text-ph-muted text-11px uppercase tracking-wider">
        <th class="py-2 text-left w-16 font-bold">排名</th>
        <th class="py-2 text-left font-bold">玩家</th>
        <th class="py-2 text-right font-bold font-mono">积分</th>
      </tr></thead>
      <tbody>
        <tr v-for="e in entries" :key="e.user_id" class="border-b border-ph-border/30 hover:bg-ph-surface/30">
          <td class="py-2">
            <span v-if="e.rank <= 3" class="inline-flex items-center gap-1 font-bold" :class="e.rank===1?'text-ph-gold':e.rank===2?'text-gray-300':'text-amber-600'">
              <Medal class="w-3.5 h-3.5" />{{ e.rank }}
            </span>
            <span v-else class="text-ph-muted font-mono">#{{ e.rank }}</span>
          </td>
          <td class="py-2">
            <div class="flex items-center gap-2">
              <img v-if="e.avatar_url" :src="e.avatar_url" class="w-5 h-5 rounded-full" />
              <span v-else class="w-5 h-5 rounded-full bg-ph-surface border border-ph-border flex items-center justify-center"><User class="w-3 h-3 text-ph-muted" /></span>
              <span class="font-bold text-ph-text">{{ e.nickname }}</span>
            </div>
          </td>
          <td class="py-2 text-right font-bold font-mono text-ph-gold">{{ e.score.toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
