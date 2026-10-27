// Scoring rules (shared semantics with the client live-check).
export const SEGMENT_SCORES = { 1: 10, 2: 6, 3: 3, skipped: 0, reveal: 3 };
export const HINT_COSTS = [0, 5, 10, 15];

export function segmentScore(attempts, status) {
  if (status === 'skipped') return 0;
  return SEGMENT_SCORES[Math.min(attempts, 3)] ?? 3;
}

export function computeResult(answers) {
  // answers: [{segment_pos, attempts, status, hint_level, words_total, words_correct}]
  let score = 0;
  let wordsTotal = 0;
  let wordsCorrect = 0;
  let hintsUsed = 0;
  let skipped = 0;
  for (const a of answers) {
    score += segmentScore(a.attempts, a.status);
    score -= HINT_COSTS[a.hint_level] || 0;
    wordsTotal += a.words_total || 0;
    wordsCorrect += a.words_correct || 0;
    if (a.hint_level > 0) hintsUsed += 1;
    if (a.status === 'skipped') skipped += 1;
  }
  score = Math.max(0, Math.round(score));
  const accuracy = wordsTotal ? Math.round((wordsCorrect / wordsTotal) * 1000) / 10 : 100;
  const stars = accuracy >= 90 && hintsUsed <= 1 ? 3 : accuracy >= 70 ? 2 : 1;
  const xpGain = score + stars * 5;
  return { score, accuracy, stars, hintsUsed, skipped, wordsTotal, wordsCorrect, xpGain };
}
