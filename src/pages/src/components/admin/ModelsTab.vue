<script setup lang="ts">
import { ref, computed } from 'vue';
import { useApi } from '@/composables/useApi';
import ChallengeCard from '@/components/ChallengeCard.vue';
import GapEditor from '@/components/GapEditor.vue';
import type { Challenge, ModelResult } from '@/types';
import { Plus, Trash2, Pencil, X, Cpu, SendHorizonal } from 'lucide-vue-next';

const props = defineProps<{ challenges: Challenge[] }>();

const publishedChallenges = computed(() => props.challenges.filter(c => c.status === 'published'));

const selectedSlug = ref('');
const modelResults = ref<ModelResult[]>([]);
const modelsLoading = ref(false);
const editingModelId = ref<number | null>(null);
const modelForm = ref({ provider: '', model_name: '', challenge_slug: '' });
const modelSegmented = ref('');
const modelMsg = ref('');

async function selectChallenge(slug: string) {
  selectedSlug.value = slug;
  editingModelId.value = null;
  modelForm.value = { provider: '', model_name: '', challenge_slug: '' };
  modelSegmented.value = '';
  modelsLoading.value = true;
  const r = await useApi<ModelResult[]>(`/admin/model-results/${slug}`);
  modelResults.value = r.success ? r.data || [] : [];
  modelsLoading.value = false;
}

function openAddModel() {
  editingModelId.value = null;
  modelForm.value = { provider: '', model_name: '', challenge_slug: selectedSlug.value };
  const raw = props.challenges.find(c => c.slug === selectedSlug.value)?.raw_text || '';
  modelSegmented.value = raw;
}

function openEditModel(m: ModelResult) {
  editingModelId.value = m.id;
  modelForm.value = { provider: m.provider, model_name: m.model_name, challenge_slug: selectedSlug.value };
  modelSegmented.value = m.segmented_text;
}

function closeForm() {
  editingModelId.value = null;
  modelForm.value = { provider: '', model_name: '', challenge_slug: '' };
  modelSegmented.value = '';
}

async function saveModelResult() {
  if (editingModelId.value) {
    const r = await useApi(`/admin/model-results/${editingModelId.value}`, {
      method: 'PUT',
      body: JSON.stringify({ segmented_text: modelSegmented.value }),
    });
    if (r.success) {
      modelMsg.value = `已更新，得分 ${(r.data as Record<string, number>).score_total}`;
      closeForm();
      selectChallenge(selectedSlug.value);
    } else { modelMsg.value = r.error || '更新失败'; }
  } else {
    const r = await useApi('/admin/model-results', {
      method: 'POST',
      body: JSON.stringify({ ...modelForm.value, segmented_text: modelSegmented.value }),
    });
    if (r.success) {
      modelMsg.value = `已添加，得分 ${(r.data as Record<string, number>).score_total}`;
      closeForm();
      selectChallenge(selectedSlug.value);
    } else { modelMsg.value = r.error || '添加失败'; }
  }
  setTimeout(() => modelMsg.value = '', 4000);
}

async function deleteModelResult(id: number) {
  await useApi(`/admin/model-results/${id}`, { method: 'DELETE' });
  selectChallenge(selectedSlug.value);
}

const selectedRawText = computed(() => props.challenges.find(c => c.slug === selectedSlug.value)?.raw_text || '');
</script>

<template>
  <div class="space-y-5">
    <!-- Challenge picker -->
    <div>
      <h3 class="text-10px text-ph-muted uppercase tracking-wider mb-2">选择挑战</h3>
      <div v-if="challenges.length === 0" class="text-xs text-ph-muted py-4">暂无已发布的挑战</div>
      <div v-else class="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <div v-for="c in publishedChallenges" :key="c.slug" @click="selectChallenge(c.slug)"
          :class="['rounded-lg border cursor-pointer transition-all duration-150',
            selectedSlug === c.slug ? 'border-ph-gold shadow-[0_0_0_1px_#f90]' : 'border-transparent hover:border-ph-border']">
          <ChallengeCard :challenge="c" />
        </div>
      </div>
    </div>

    <!-- Selected challenge -->
    <template v-if="selectedSlug">
      <div class="border-t border-ph-border pt-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-11px font-bold text-ph-muted uppercase tracking-wider flex items-center gap-1.5">
            <Cpu class="w-3 h-3" /> {{ modelResults.length }} 条记录
          </h3>
          <button @click="openAddModel" class="btn-primary text-11px"><Plus class="w-3 h-3" /> 添加</button>
        </div>

        <!-- Add / Edit panel -->
        <div v-if="modelForm.challenge_slug || editingModelId" class="border border-ph-border rounded-lg mb-4 overflow-hidden">
          <div class="px-4 py-3 border-b border-ph-border bg-ph-card space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Cpu class="w-3.5 h-3.5 text-ph-gold" />
                <span class="text-11px font-bold text-ph-muted uppercase tracking-wider">{{ editingModelId ? '编辑' : '新增' }}</span>
              </div>
              <button @click="closeForm" class="btn-ghost text-11px px-1"><X class="w-3 h-3" /></button>
            </div>
            <template v-if="!editingModelId">
              <div class="flex items-stretch gap-0">
                <div class="flex items-center gap-2 bg-ph-black border border-ph-border rounded-l-lg px-3 py-2 min-w-0 flex-1">
                  <span class="text-10px text-ph-gold font-bold uppercase tracking-wider shrink-0">Provider</span>
                  <input v-model="modelForm.provider" placeholder="openai" class="bg-transparent border-none outline-none text-xs text-ph-text placeholder:text-ph-muted/30 flex-1 min-w-0 font-mono" />
                </div>
                <div class="flex items-center gap-2 bg-ph-black border border-l-0 border-ph-border rounded-r-lg px-3 py-2 min-w-0 flex-1">
                  <span class="text-10px text-ph-gold font-bold uppercase tracking-wider shrink-0">Model</span>
                  <input v-model="modelForm.model_name" placeholder="gpt-4o" class="bg-transparent border-none outline-none text-xs text-ph-text placeholder:text-ph-muted/30 flex-1 min-w-0 font-mono" />
                </div>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center gap-2 bg-ph-black border border-ph-border rounded-lg px-3 py-2">
                <span class="text-10px text-ph-muted uppercase tracking-wider">Provider</span>
                <span class="text-xs font-bold text-ph-gold font-mono">{{ modelForm.provider }}</span>
                <span class="text-ph-border">/</span>
                <span class="text-10px text-ph-muted uppercase tracking-wider">Model</span>
                <span class="text-xs font-bold text-ph-text font-mono">{{ modelForm.model_name }}</span>
              </div>
            </template>
          </div>
          <GapEditor :raw-text="selectedRawText" v-model="modelSegmented" />
          <div class="flex items-center justify-between px-4 py-3 border-t border-ph-border bg-ph-card">
            <p v-if="modelMsg" class="text-11px font-bold" :class="modelMsg.includes('得分') || modelMsg.includes('已') ? 'text-green-400' : 'text-red-400'">{{ modelMsg }}</p>
            <span v-else-if="!editingModelId" class="text-10px text-ph-muted">同一 provider + model 会覆盖已有记录</span>
            <span v-else />
            <button @click="saveModelResult" class="btn-primary text-11px"><SendHorizonal class="w-3 h-3" /> {{ editingModelId ? '更新评分' : '提交评分' }}</button>
          </div>
        </div>

        <!-- Results list -->
        <div v-if="modelsLoading" class="text-center py-4 text-ph-muted text-xs">加载中...</div>
        <div v-else-if="modelResults.length === 0" class="text-center py-6 text-ph-muted text-xs">暂无记录</div>
        <div v-else class="space-y-1">
          <div v-for="m in modelResults" :key="m.id" class="bg-ph-surface border border-ph-border rounded-lg px-4 py-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="text-xs font-bold text-ph-text truncate">{{ m.model_name }}</p>
                  <span class="text-10px text-ph-muted bg-ph-black px-1.5 py-0.5 rounded">{{ m.provider }}</span>
                </div>
                <p class="text-10px text-ph-muted mt-1.5 break-all leading-relaxed line-clamp-2">{{ m.segmented_text }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <p class="text-xl font-black font-mono" :class="m.score_total >= 800 ? 'text-ph-gold' : m.score_total >= 500 ? 'text-ph-text' : 'text-ph-muted'">{{ m.score_total }}</p>
                <div class="flex flex-col gap-0.5">
                  <button @click="openEditModel(m)" class="btn-ghost text-11px px-1 py-0.5"><Pencil class="w-2.5 h-2.5" /></button>
                  <button @click="deleteModelResult(m.id)" class="btn-ghost text-11px px-1 py-0.5 text-red-400"><Trash2 class="w-2.5 h-2.5" /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
