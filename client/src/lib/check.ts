// Answer checking: normalization, word-level diff (LCS), Kazakh letter-confusion
// detection and scoring. Mirrors server-side semantics in server/src/check.js.

export const PUNCT = /[\s.,!?;:«»"«»()—…\-,'’‘“”]+/;

// Kazakh-specific letters that children often confuse with Russian lookalikes.
export const LETTER_CONFUSIONS: [string, string][] = [
  ['қ', 'к'], ['ғ', 'г'], ['ә', 'а'], ['ө', 'о'], ['ұ', 'у'],
  ['ү', 'у'], ['ү', 'ю'], ['ң', 'н'], ['і', 'и'], ['һ', 'х'], ['ы', 'и'],
];

export function normalizeWord(w: string, level: number): string {
  let s = w.toLowerCase().replace(/\u00a0/g, ' ');
  if (level <= 1) s = s.replace(/[\.,!?;:«»"()—…\-,'’‘“”]+/g, '');
  else s = s.replace(/^[\.,!?;:«»"()\s—…]+|[\.,!?;:«»"()\s—…]+$/g, '');
  return s;
}

export function tokenize(text: string, level: number): string[] {
  return text
    .split(/\s+/)
    .map((w) => normalizeWord(w, level))
    .filter(Boolean);
}

export interface DiffToken {
  kind: 'ok' | 'wrong' | 'missing' | 'extra';
  child: string;   // typed word (may be '')
  correct: string; // expected word (may be '')
}

export interface CheckResult {
  ok: boolean;
  correctCount: number;
  totalCount: number;
  tokens: DiffToken[];
  letterHints: { expected: string; found: string; word: string }[];
  missingCount: number;
  extraCount: number;
  firstTry: boolean;
}

// Word-level diff via LCS (segments are short, O(n*m) is fine).
export function diffWords(childWords: string[], correctWords: string[]): DiffToken[] {
  const n = childWords.length;
  const m = correctWords.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = childWords[i] === correctWords[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const tokens: DiffToken[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (childWords[i] === correctWords[j]) {
      tokens.push({ kind: 'ok', child: childWords[i], correct: correctWords[j] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      tokens.push({ kind: 'extra', child: childWords[i], correct: '' });
      i++;
    } else {
      tokens.push({ kind: 'missing', child: '', correct: correctWords[j] });
      j++;
    }
  }
  while (i < n) { tokens.push({ kind: 'extra', child: childWords[i], correct: '' }); i++; }
  while (j < m) { tokens.push({ kind: 'missing', child: '', correct: correctWords[j] }); j++; }
  return tokens;
}

// Does `child` differ from `correct` only by a confusable Kazakh letter?
export function letterMismatch(child: string, correct: string): { expected: string; found: string } | null {
  if (child.length !== correct.length) return null;
  let diffs = 0;
  let found: { expected: string; found: string } | null = null;
  for (let k = 0; k < correct.length; k++) {
    const c = correct[k];
    const w = child[k];
    if (c === w) continue;
    diffs++;
    if (diffs > 1) return null;
    const pair = LETTER_CONFUSIONS.find(([a, b]) => (a === c && b === w) || (b === c && a === w));
    if (!pair) return null;
    found = { expected: c, found: w };
  }
  return diffs === 1 ? found : null;
}

export function checkAnswer(typed: string, correctText: string, level: number, attemptsSoFar: number): CheckResult {
  const childWords = tokenize(typed, level);
  const correctWords = tokenize(correctText, level);
  const tokens = diffWords(childWords, correctWords);
  let correctCount = 0;
  const letterHints: CheckResult['letterHints'] = [];
  let missingCount = 0;
  let extraCount = 0;
  for (const t of tokens) {
    if (t.kind === 'ok') { correctCount++; continue; }
    if (t.kind === 'missing') { missingCount++; continue; }
    if (t.kind === 'extra') { extraCount++; continue; }
    // wrong: check for a Kazakh letter swap → gentle specific hint
    const lm = letterMismatch(t.child, t.correct);
    if (lm) letterHints.push({ ...lm, word: t.correct });
  }
  const ok = correctCount === correctWords.length && correctWords.length > 0 && missingCount === 0 && extraCount === 0;
  return { ok, correctCount, totalCount: correctWords.length, tokens, letterHints, missingCount, extraCount, firstTry: attemptsSoFar === 0 };
}

// --- scoring (same rules as server) ---
export const SEGMENT_SCORES = { 1: 10, 2: 6, 3: 3 } as Record<number, number>;
export const HINT_COSTS = [0, 5, 10, 15];
export const MAX_SKIPS = 3;
export const MAX_ATTEMPTS = 3;

export function segmentScore(attempts: number, status: 'correct' | 'skipped'): number {
  if (status === 'skipped') return 0;
  return SEGMENT_SCORES[Math.min(attempts, 3)] ?? 3;
}

export function liveScore(answers: AnswerRecord[], scoreStart = 0): number {
  let s = scoreStart;
  for (const a of answers) {
    s += segmentScore(a.attempts, a.status);
    s -= HINT_COSTS[a.hintLevel] || 0;
  }
  return Math.max(0, Math.round(s));
}

export interface AnswerRecord {
  pos: number;
  attempts: number;
  status: 'correct' | 'skipped';
  hintLevel: number;
  wordsTotal: number;
  wordsCorrect: number;
  wordsWrong: string[];
  letterErrors: Record<string, number>;
  typedText?: string;
}

export function starsFor(accuracy: number, hintsUsed: number): number {
  return accuracy >= 90 && hintsUsed <= 1 ? 3 : accuracy >= 70 ? 2 : 1;
}

export const LEVELS = [
  { xp: 0, name: 'Жас жазушы', emoji: '✏️' },
  { xp: 100, name: 'Кішкентай ертегіші', emoji: '📖' },
  { xp: 250, name: 'Ертегіші', emoji: '🎨' },
  { xp: 500, name: 'Үздік жазушы', emoji: '🏆' },
  { xp: 1000, name: 'Алтын қалам', emoji: '👑' },
];

export function levelFor(xp: number) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].xp) idx = i;
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  const progress = next ? Math.min(100, Math.round(((xp - cur.xp) / (next.xp - cur.xp)) * 100)) : 100;
  return { index: idx, name: cur.name, emoji: cur.emoji, next: next ? next.name : null, nextXp: next ? next.xp : null, progress };
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
