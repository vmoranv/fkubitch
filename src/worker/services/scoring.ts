import type { AnswerKey } from '../types';

export interface ScoreBreakdown {
  score_total: number;
  score_segment: number;
  score_penalty: number;
  extra: number;
  missed: number;
  matched: number;
}

export function scoreSubmission(
  rawText: string,
  segmentedText: string,
  answerKeyJson: string
): ScoreBreakdown {
  // Extract user separator positions from | delimited text
  const userPositions = extractPositions(segmentedText, rawText);

  // Standard positions from answer key
  const stdKey: AnswerKey = JSON.parse(answerKeyJson);
  const stdPositions = stdKey.positions.sort((a, b) => a - b);

  if (userPositions.length === 0 && stdPositions.length === 0) {
    return { score_total: 1000, score_segment: 1000, score_penalty: 0, extra: 0, missed: 0, matched: 0 };
  }

  // Greedy match: pair each user position with nearest unmatched standard position
  const matched: number[] = [];
  const used = new Set<number>();

  for (const up of userPositions) {
    let bestStd = -1;
    let bestDist = Infinity;
    for (const sp of stdPositions) {
      if (used.has(sp)) continue;
      const dist = Math.abs(up - sp);
      if (dist < bestDist) {
        bestDist = dist;
        bestStd = sp;
      }
    }
    if (bestStd >= 0) {
      matched.push(bestStd); // user position up matched to standard position bestStd
      used.add(bestStd);
    }
  }

  const extra = userPositions.length - matched.length;
  const missed = stdPositions.length - matched.length;

  // Score: base on matched positions, penalize extras and misses
  const total = Math.max(stdPositions.length, userPositions.length);
  const scoreSegment = stdPositions.length > 0
    ? Math.round(1000 * (matched.length / stdPositions.length))
    : (userPositions.length === 0 ? 1000 : 500);

  // Penalty: extra splits tolerated up to 1, more gets penalized
  // Tolerance: 1 extra split = no penalty, 2+ = -50 each
  const tolerancePenalty = Math.max(0, extra - 1) * 50;
  const missPenalty = missed * 150;

  const scorePenalty = Math.max(0, tolerancePenalty + missPenalty);
  const scoreTotal = Math.max(0, Math.min(1000, scoreSegment - scorePenalty));

  return {
    score_total: scoreTotal,
    score_segment: scoreSegment,
    score_penalty: scorePenalty,
    extra,
    missed,
    matched: matched.length,
  };
}

function extractPositions(segmentedText: string, rawText: string): number[] {
  // Text uses | as separator, e.g. "大英警|察进比利时|等妲己把|茶倒杯里"
  // Remove all whitespace
  const clean = segmentedText.replace(/\s+/g, '');

  const positions: number[] = [];
  let rawIdx = 0;

  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '|') {
      positions.push(rawIdx);
    } else if (rawIdx < rawText.length && clean[i] === rawText[rawIdx]) {
      rawIdx++;
    }
    // If char doesn't match raw text, skip it (user may have added extra chars)
  }

  return positions.sort((a, b) => a - b);
}
