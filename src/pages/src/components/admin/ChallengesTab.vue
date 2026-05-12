<script setup lang="ts">
import { ref } from 'vue';
import { useApi } from '@/composables/useApi';
import type { Challenge } from '@/types';
import { Save, Pencil, Trash2, Cpu, Plus } from 'lucide-vue-next';

defineProps<{ challenges: Challenge[]; loading: boolean }>();
const emit = defineEmits<{ reload: [] }>();

const showForm = ref(false);
const editingSlug = ref<string | null>(null);
const form = ref({ slug: '', raw_text: '', answer_key_json: '{"positions":[]}', status: 'published' });
const formMsg = ref('');

function startCreate() {
  editingSlug.value = null;
  form.value = { slug: '', raw_text: '', answer_key_json: '{"positions":[]}', status: 'published' };
  showForm.value = true; formMsg.value = '';
}

function startEdit(c: Challenge) {
  editingSlug.value = c.slug;
  form.value = { slug: c.slug, raw_text: c.raw_text, answer_key_json: c.answer_key_json, status: c.status };
  showForm.value = true; formMsg.value = '';
}

async function saveChallenge() {
  const isEdit = !!editingSlug.value;
  const r = isEdit
    ? await useApi(`/admin/challenges/${editingSlug.value}`, { method: 'PUT', body: JSON.stringify(form.value) })
    : await useApi('/admin/challenges', { method: 'POST', body: JSON.stringify(form.value) });
  formMsg.value = r.success ? (isEdit ? '已更新' : `已创建: ${form.value.slug}`) : (r.error || '失败');
  if (r.success) { showForm.value = false; emit('reload'); }
  setTimeout(() => formMsg.value = '', 3000);
}

async function deleteChallenge(slug: string) {
  if (!confirm(`删除 ${slug}?`)) return;
  await useApi(`/admin/challenges/${slug}`, { method: 'DELETE' });
  emit('reload');
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm font-bold text-ph-muted">{{ challenges.length }} 个挑战</h2>
      <button @click="startCreate" class="btn-primary text-11px"><Plus class="w-3.5 h-3.5" /> 新增</button>
    </div>

    <div v-if="showForm" class="bg-ph-surface border border-ph-border rounded-lg p-4 mb-4 space-y-3">
      <div v-if="!editingSlug">
        <label class="text-10px text-ph-muted uppercase tracking-wider block mb-1">Slug</label>
        <input v-model="form.slug" placeholder="a3f7c2d1" class="input" />
      </div>
      <div>
        <label class="text-10px text-ph-muted uppercase tracking-wider block mb-1">原始文本</label>
        <textarea v-model="form.raw_text" placeholder="大英警察进比利时等妲己把茶倒杯里" class="input h-16 resize-y" />
      </div>
      <div>
        <label class="text-10px text-ph-muted uppercase tracking-wider block mb-1">答案 (JSON)</label>
        <input v-model="form.answer_key_json" placeholder='{"positions":[3,8,12]}' class="input font-mono text-11px" />
      </div>
      <div>
        <label class="text-10px text-ph-muted uppercase tracking-wider block mb-1">状态</label>
        <div class="flex gap-1 flex-wrap">
          <button v-for="s in ['published','draft','archived'] as const" :key="s"
            :class="form.status === s ? 'btn-primary text-11px' : 'btn-ghost text-11px'" @click="form.status = s">{{ s }}</button>
        </div>
      </div>
      <div class="flex gap-2">
        <button @click="saveChallenge" class="btn-primary text-11px"><Save class="w-3 h-3" /> {{ editingSlug ? '更新' : '创建' }}</button>
        <button @click="showForm = false" class="btn-ghost text-11px">取消</button>
      </div>
      <p v-if="formMsg" class="text-11px" :class="formMsg.includes('已') ? 'text-green-400' : 'text-red-400'">{{ formMsg }}</p>
    </div>

    <div v-if="loading" class="space-y-2"><div v-for="i in 3" :key="i" class="skeleton h-14" /></div>
    <div v-else-if="challenges.length === 0" class="text-center py-8 text-ph-muted text-xs">暂无挑战</div>
    <div v-else class="space-y-1.5">
      <div v-for="c in challenges" :key="c.slug" class="bg-ph-surface border border-ph-border rounded-lg px-3 sm:px-4 py-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold text-ph-text truncate">{{ c.raw_text }}</p>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <span class="text-10px text-ph-muted font-mono">{{ c.slug }}</span>
              <span class="text-10px px-1.5 py-0.5 rounded font-bold" :class="{
                'bg-green-400/10 text-green-400': c.status === 'published',
                'bg-yellow-400/10 text-yellow-400': c.status === 'draft',
                'bg-ph-muted/10 text-ph-muted line-through': c.status === 'archived',
                'bg-blue-400/10 text-blue-400': c.status === 'pending',
              }">{{ c.status }}</span>
              <span v-if="c.model_count" class="text-10px text-ph-muted flex items-center gap-0.5"><Cpu class="w-2.5 h-2.5" />{{ c.model_count }}</span>
            </div>
          </div>
          <div class="flex gap-1 shrink-0">
            <button @click="startEdit(c)" class="btn-ghost text-11px px-2"><Pencil class="w-3 h-3" /></button>
            <button @click="deleteChallenge(c.slug)" class="btn-ghost text-11px px-2 text-red-400"><Trash2 class="w-3 h-3" /></button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
