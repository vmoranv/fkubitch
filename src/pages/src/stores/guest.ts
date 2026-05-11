import { defineStore } from 'pinia';
import { ref } from 'vue';

interface PracticeRecord {
  challengeSlug: string;
  segmentedText: string;
  score: number;
  timestamp: number;
}

interface DraftRecord {
  challengeSlug: string;
  segmentedText: string;
  timestamp: number;
}

const PRACTICE_KEY = 'dj_practice_history';
const DRAFTS_KEY = 'dj_drafts';
const PREFS_KEY = 'dj_prefs';

export const useGuestStore = defineStore('guest', () => {
  const practiceHistory = ref<PracticeRecord[]>(load(PRACTICE_KEY) || []);
  const drafts = ref<DraftRecord[]>(load(DRAFTS_KEY) || []);
  const preferences = ref<{ fontSize: 'normal' | 'large' }>(load(PREFS_KEY) || { fontSize: 'normal' });

  function savePractice(record: PracticeRecord) {
    practiceHistory.value.unshift(record);
    if (practiceHistory.value.length > 50) practiceHistory.value.pop();
    persist(PRACTICE_KEY, practiceHistory.value);
  }

  function saveDraft(draft: DraftRecord) {
    const idx = drafts.value.findIndex((d) => d.challengeSlug === draft.challengeSlug);
    if (idx >= 0) {
      drafts.value[idx] = draft;
    } else {
      drafts.value.unshift(draft);
    }
    if (drafts.value.length > 20) drafts.value.pop();
    persist(DRAFTS_KEY, drafts.value);
  }

  function getDraft(slug: string): DraftRecord | undefined {
    return drafts.value.find((d) => d.challengeSlug === slug);
  }

  function removeDraft(slug: string) {
    drafts.value = drafts.value.filter((d) => d.challengeSlug !== slug);
    persist(DRAFTS_KEY, drafts.value);
  }

  function updatePrefs(prefs: { fontSize?: 'normal' | 'large' }) {
    Object.assign(preferences.value, prefs);
    persist(PREFS_KEY, preferences.value);
  }

  return {
    practiceHistory,
    drafts,
    preferences,
    savePractice,
    saveDraft,
    getDraft,
    removeDraft,
    updatePrefs,
  };
});

function load(key: string) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full, ignore
  }
}
