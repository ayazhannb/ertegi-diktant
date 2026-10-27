// Shared API types.
export type Role = 'student' | 'teacher' | 'admin' | 'guest';

export interface UserLevel {
  index: number; name: string; emoji: string;
  next: string | null; nextXp: number | null; progress: number;
}

export interface Badge {
  code: string; emoji: string; name: string; desc: string;
  earnedAt: string | null;
}

export interface User {
  id: number; name: string; username: string; role: Role;
  avatar: string;
  settings: {
    theme?: 'light' | 'dark';
    textSize?: 'sm' | 'md' | 'lg';
    dyslexia?: boolean;
    sound?: boolean;
    defaultSpeed?: number;
  };
  xp: number; streak: number; onboardingDone: boolean;
  level: UserLevel; badges: Badge[];
}

export interface TaleListItem {
  id: number; title: string; level: number; category: string;
  ageMin: number; ageMax: number; description: string;
  thumbnail: string; duration: number; youtubeId: string;
  segmentCount: number;
  best: { stars: number; score: number } | null;
  resume: { attemptId: number; segment: number; count: number } | null;
  isHomework: boolean;
}

export interface Segment {
  pos: number; start_sec: number; end_sec: number; text: string;
}

export interface TaleDetail {
  tale: {
    id: number; title: string; level: number; category: string;
    description: string; thumbnail: string; duration: number; youtubeId: string;
  };
  segments: Segment[];
  resume: { attemptId: number; segment: number; count: number } | null;
}

export interface FinishResult {
  score: number; accuracy: number; stars: number; hintsUsed: number;
  skipped: number; wordsTotal: number; wordsCorrect: number; xpGain: number;
  streak: number;
  newBadges: { code: string; emoji: string; name: string; desc: string }[];
}

export interface DictWord {
  id: number; word: string; example: string; times_wrong: number; learned: number;
}

export interface ProgressData {
  completed: { id: number; score: number; stars: number; accuracy: number; finished_at: string; hints_used: number; title: string; level: number }[];
  weekly: { date: string; label: string; count: number }[];
  dictCount: number; learned: number;
}

export interface TeacherClass { id: number; name: string; members: number }
export interface ClassDetail {
  class: { id: number; name: string };
  members: { id: number; name: string; username: string; avatar: string; tales_done: number; avg_accuracy: number | null; xp: number }[];
  homework: { id: number; tale_id: number; title: string; due_date: string }[];
}
export interface Analytics {
  topWords: { word: string; n: number }[];
  topLetters: { letter: string; n: number }[];
}

export interface AdminTale {
  id: number; youtube_id: string; title: string; level: number; category: string;
  age_min: number; age_max: number; description: string; thumbnail: string;
  duration: number; active: number; seg_count: number;
}
