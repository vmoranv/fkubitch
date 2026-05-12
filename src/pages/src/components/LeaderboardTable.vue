<script setup lang="ts">
import type { LeaderboardEntry } from '@/types';
import { Medal, User } from 'lucide-vue-next';
defineProps<{ entries: LeaderboardEntry[]; loading: boolean }>();
</script>

<template>
  <div class="bg-ph-surface border border-ph-border rounded-lg overflow-hidden">
    <div v-if="loading" class="space-y-2 p-3">
      <div v-for="i in 5" :key="i" class="skeleton h-8 w-full" />
    </div>
    <div v-else-if="entries.length === 0" class="text-center py-8 text-ph-muted text-xs font-bold uppercase tracking-wider">
      暂无数据
    </div>
    <!-- Mobile: card layout -->
    <div class="sm:hidden divide-y divide-ph-border/30">
      <div v-for="e in entries" :key="e.user_id" class="flex items-center gap-3 px-4 py-3">
        <span class="w-6 text-center shrink-0">
          <span v-if="e.rank <= 3" class="font-bold" :class="e.rank===1?'text-ph-gold':e.rank===2?'text-gray-300':'text-amber-600'">
            <Medal class="w-4 h-4 inline" />
          </span>
          <span v-else class="text-ph-muted font-mono text-11px">#{{ e.rank }}</span>
        </span>
        <img v-if="e.avatar_url" :src="e.avatar_url" class="w-7 h-7 rounded-full shrink-0" />
        <div v-else class="w-7 h-7 rounded-full bg-ph-card border border-ph-border flex items-center justify-center shrink-0">
          <User class="w-3.5 h-3.5 text-ph-muted" />
        </div>
        <span class="font-bold text-ph-text text-xs flex-1 truncate">{{ e.nickname }}</span>
        <span class="font-bold font-mono text-ph-gold text-sm shrink-0">{{ e.score }}</span>
      </div>
    </div>
    <!-- Desktop: table -->
    <table class="hidden sm:table w-full text-11px">
      <thead><tr class="border-b border-ph-border text-ph-muted text-11px uppercase tracking-wider">
        <th class="py-2.5 pl-4 text-left w-16 font-bold">排名</th>
        <th class="py-2.5 text-left font-bold">玩家</th>
        <th class="py-2.5 pr-4 text-right font-bold font-mono">积分</th>
      </tr></thead>
      <tbody>
        <tr v-for="e in entries" :key="e.user_id" class="border-b border-ph-border/30 hover:bg-ph-card/50 transition-colors">
          <td class="py-2.5 pl-4">
            <span v-if="e.rank <= 3" class="inline-flex items-center gap-1 font-bold" :class="e.rank===1?'text-ph-gold':e.rank===2?'text-gray-300':'text-amber-600'">
              <Medal class="w-3.5 h-3.5" />{{ e.rank }}
            </span>
            <span v-else class="text-ph-muted font-mono">#{{ e.rank }}</span>
          </td>
          <td class="py-2.5">
            <div class="flex items-center gap-2">
              <img v-if="e.avatar_url" :src="e.avatar_url" class="w-5 h-5 rounded-full" />
              <div v-else class="w-5 h-5 rounded-full bg-ph-card border border-ph-border flex items-center justify-center">
                <User class="w-3 h-3 text-ph-muted" />
              </div>
              <span class="font-bold text-ph-text">{{ e.nickname }}</span>
            </div>
          </td>
          <td class="py-2.5 pr-4 text-right font-bold font-mono text-ph-gold">{{ e.score.toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
