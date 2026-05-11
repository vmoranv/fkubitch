import { useGuestStore } from '@/stores/guest';

export function useGuest() {
  const guest = useGuestStore();

  function markPracticeComplete(slug: string, score: number) {
    guest.savePractice({
      challengeSlug: slug,
      segmentedText: '',
      score,
      timestamp: Date.now(),
    });
  }

  function getGuestHistory() {
    return guest.practiceHistory;
  }

  function clearGuestHistory() {
    guest.practiceHistory = [];
    guest.drafts = [];
    localStorage.removeItem('dj_practice_history');
    localStorage.removeItem('dj_drafts');
  }

  return {
    markPracticeComplete,
    getGuestHistory,
    clearGuestHistory,
  };
}
