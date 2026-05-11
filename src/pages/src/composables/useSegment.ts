import type { Challenge, ScoreData, Submission } from '@/types';
import { useChallengeStore } from '@/stores/challenge';
import { useGuestStore } from '@/stores/guest';
import { useApi } from './useApi';

export function useSegment() {
  const challengeStore = useChallengeStore();
  const guestStore = useGuestStore();

  async function submitForScore(turnstileToken: string): Promise<ScoreData | null> {
    if (!challengeStore.currentChallenge) return null;
    challengeStore.isSubmitting = true;
    try {
      const result = await useApi<ScoreData & { submission_id: string; total_score: number; rank: number }>(
        `/challenges/${challengeStore.currentChallenge.slug}/submit`,
        {
          method: 'POST',
          headers: { 'X-Turnstile-Token': turnstileToken },
          body: JSON.stringify({ segmented_text: challengeStore.segmentedText }),
        }
      );
      if (result.success && result.data) {
        challengeStore.submitResult = result.data;
        return result.data;
      }
      return null;
    } finally {
      challengeStore.isSubmitting = false;
    }
  }

  async function loadChallengeDetails(slug: string): Promise<Challenge | null> {
    const result = await useApi<Challenge>(`/challenges/${slug}`);
    if (result.success && result.data) {
      const draft = guestStore.getDraft(slug);
      challengeStore.setChallenge(result.data, draft?.segmentedText);
      return result.data;
    }
    return null;
  }

  async function loadChallengeSubmissions(slug: string) {
    const result = await useApi<Submission[]>(`/challenges/${slug}/submissions`);
    if (result.success && result.data) {
      challengeStore.submissions = result.data;
    }
  }

  function saveDraft() {
    if (!challengeStore.currentChallenge) return;
    guestStore.saveDraft({
      challengeSlug: challengeStore.currentChallenge.slug,
      segmentedText: challengeStore.segmentedText,
      timestamp: Date.now(),
    });
  }

  return {
    submitForScore,
    loadChallengeDetails,
    loadChallengeSubmissions,
    saveDraft,
  };
}
