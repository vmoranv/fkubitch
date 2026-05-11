import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Challenge, ScoreData, Submission, ModelResult } from '@/types';

export const useChallengeStore = defineStore('challenge', () => {
  const currentChallenge = ref<Challenge | null>(null);
  const segmentedText = ref('');
  const isSubmitting = ref(false);
  const practiceResult = ref<ScoreData | null>(null);
  const submitResult = ref<ScoreData & { submission_id?: string; total_score?: number; rank?: number } | null>(null);
  const submissions = ref<Submission[]>([]);
  const modelResults = ref<ModelResult[]>([]);

  function setChallenge(challenge: Challenge, initialText?: string) {
    currentChallenge.value = challenge;
    segmentedText.value = initialText || challenge.raw_text;
    practiceResult.value = null;
    submitResult.value = null;
    submissions.value = [];
    modelResults.value = [];
  }

  function insertPunctuation(punct: string, cursorPos: number) {
    const before = segmentedText.value.slice(0, cursorPos);
    const after = segmentedText.value.slice(cursorPos);
    segmentedText.value = before + punct + after;
  }

  function clear() {
    segmentedText.value = currentChallenge.value?.raw_text || '';
    practiceResult.value = null;
    submitResult.value = null;
  }

  function undo() {
    if (!currentChallenge.value) return;
    if (segmentedText.value === currentChallenge.value.raw_text) return;

    // Remove the last inserted punctuation character
    const puncts = /[，。！？；：、""''「」『』【】《》（）,…\!\?\;\:\"\'\.]/g;
    let lastIdx = -1;
    let match: RegExpExecArray | null;
    const text = segmentedText.value;
    while ((match = puncts.exec(text)) !== null) {
      lastIdx = match.index;
    }

    if (lastIdx >= 0) {
      segmentedText.value = text.slice(0, lastIdx) + text.slice(lastIdx + 1);
    }
  }

  function syncFromEditor(text: string) {
    segmentedText.value = text;
  }

  return {
    currentChallenge,
    segmentedText,
    isSubmitting,
    practiceResult,
    submitResult,
    submissions,
    modelResults,
    setChallenge,
    insertPunctuation,
    clear,
    undo,
    syncFromEditor,
  };
});
