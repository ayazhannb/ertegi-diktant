// Seed script: runs automatically on first start (empty DB).
// Creates test accounts (documented in README), demo tales + segments,
// a demo class with progress data so the teacher panel is alive.
import bcrypt from 'bcryptjs';
import db from './db.js';
import TALES, { distribute, thumb } from './tales-seed.js';
import { computeResult } from './check.js';

export function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) return false;

  const insUser = db.prepare(`
    INSERT INTO users (name, username, password_hash, role, avatar, settings, xp, streak, last_active_date, onboarding_done)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const h = (p) => bcrypt.hashSync(p, 10);
  const today = new Date().toISOString().slice(0, 10);

  const users = [
    ['Аябота', 'aybota', h('Aybota2026!'), 'student', 'fox', JSON.stringify({ theme: 'light' }), 0, 0, null, 0],
    ['Гүлсара мұғалім', 'gulessar', h('Gulesar2026!'), 'teacher', 'bird', '{}', 0, 0, null, 1],
    ['Әкімші', 'admin', h('Admin2026!'), 'admin', 'sun', '{}', 0, 0, null, 1],
    ['Азиз', 'aziz', h('Aziz2026!'), 'student', 'bear', '{}', 0, 0, null, 1],
    ['Динара', 'dinara', h('Dinara2026!'), 'student', 'cat', '{}', 0, 0, null, 1],
    ['Марат', 'marat', h('Marat2026!'), 'student', 'horse', '{}', 0, 0, null, 1],
  ];
  for (const u of users) insUser.run(...u);
  const userIds = Object.fromEntries(
    db.prepare('SELECT id, username FROM users').all().map((r) => [r.username, r.id])
  );

  // Tales + segments
  const insTale = db.prepare(`
    INSERT INTO tales (youtube_id, title, level, category, age_min, age_max, description, thumbnail, duration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insSeg = db.prepare('INSERT INTO segments (tale_id, pos, start_sec, end_sec, text) VALUES (?, ?, ?, ?, ?)');
  const taleIds = [];
  for (const t of TALES) {
    const info = insTale.run(t.youtubeId, t.title, t.level, t.category, t.ageMin, t.ageMax, t.description, thumb(t.youtubeId), t.duration);
    const taleId = info.lastInsertRowid;
    taleIds.push(taleId);
    const spans = distribute(t.duration, t.segments.length);
    t.segments.forEach((text, i) => insSeg.run(taleId, i, spans[i].start_sec, spans[i].end_sec, text));
  }

  // Demo class
  const cls = db.prepare('INSERT INTO classes (name, teacher_id) VALUES (?, ?)').run('5-А сынып', userIds.gulessar);
  for (const u of ['aybota', 'aziz', 'dinara', 'marat']) {
    db.prepare('INSERT INTO class_members (class_id, user_id) VALUES (?, ?)').run(cls.lastInsertRowid, userIds[u]);
  }

  // Demo progress for students (deterministic pseudo-random by index)
  const wordPool = ['орман', 'қасқыр', 'бауырсақ', 'аю', 'шалқан', 'балық', 'рахмет', 'көрші', 'қонақ', 'түсінді'];
  const finishAttempt = (user, taleId, seedN) => {
    const segs = db.prepare('SELECT * FROM segments WHERE tale_id = ? ORDER BY pos').all(taleId);
    const att = db.prepare(`
      INSERT INTO attempts (user_id, tale_id, segment_count, current_segment, finished_at, status, score, stars, accuracy, hints_used, words_total, words_correct, skipped)
      VALUES (?, ?, ?, ?, datetime('now', ?), 'finished', 0, 0, 0, 0, 0, 0, 0)`).run(user, taleId, segs.length, segs.length - 1, `-${seedN} day`);
    const letterErr = {};
    const LETTER_PAIRS = [['қ', 'қ/к'], ['ғ', 'ғ/г'], ['ң', 'ң/н'], ['і', 'і/и'], ['ә', 'ә/а'], ['ө', 'ө/о'], ['ұ', 'ұ/у'], ['ү', 'ү/у'], ['һ', 'һ/х']];
    const answers = segs.map((s, i) => {
      const words = s.text.trim().split(/\s+/);
      const bad = seedN % 3 === 0 ? i % 4 === 1 : i % 5 === 2;
      const atts = bad ? 2 : 1;
      const wrong = bad ? [words[seedN % words.length]] : [];
      for (const w of wrong) {
        const lw = w.toLowerCase();
        for (const [ch, pair] of LETTER_PAIRS) {
          if (lw.includes(ch)) { letterErr[pair] = (letterErr[pair] || 0) + 1; break; }
        }
      }
      const a = {
        segment_pos: i, attempts: atts, status: 'correct', hint_level: 0,
        words_total: words.length, words_correct: words.length - wrong.length, words_wrong: wrong,
      };
      db.prepare(`INSERT INTO attempt_answers (attempt_id, segment_pos, attempts, status, hint_level, words_total, words_correct, words_wrong)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(att.lastInsertRowid, a.segment_pos, a.attempts, a.status, a.hint_level, a.words_total, a.words_correct, JSON.stringify(a.words_wrong));
      return a;
    });
    const res = computeResult(answers);
    db.prepare(`UPDATE attempts SET score=?, stars=?, accuracy=?, hints_used=?, words_total=?, words_correct=?, letter_errors=? WHERE id=?`)
      .run(res.score, res.stars, res.accuracy, res.hintsUsed, res.wordsTotal, res.wordsCorrect, JSON.stringify(letterErr), att.lastInsertRowid);
    // dictionary words
    for (const w of new Set(answers.flatMap((a) => a.words_wrong))) {
      db.prepare(`INSERT OR IGNORE INTO dictionary_words (user_id, word, example, times_wrong) VALUES (?, ?, ?, 1)`)
        .run(user, w, segs[Math.floor(seedN / segs.length) % segs.length].text);
    }
    // xp / streak / badges (simplified direct update for seed data)
    db.prepare('UPDATE users SET xp = xp + ?, streak = MAX(streak, ?), last_active_date = ? WHERE id = ?')
      .run(res.xpGain, (seedN % 2) + 1, today, user);
  };

  finishAttempt(userIds.aziz, taleIds[0], 1);
  finishAttempt(userIds.aziz, taleIds[1], 2);
  finishAttempt(userIds.dinara, taleIds[0], 3);
  finishAttempt(userIds.dinara, taleIds[3], 4);
  finishAttempt(userIds.marat, taleIds[0], 5);
  finishAttempt(userIds.marat, taleIds[2], 6);
  finishAttempt(userIds.aziz, taleIds[3], 7);
  finishAttempt(userIds.dinara, taleIds[4], 8);

  // Homework: assign tale 5 (Қызыл телпек) to the class
  const hw = db.prepare('INSERT INTO homework (class_id, tale_id, due_date) VALUES (?, ?, ?)').run(cls.lastInsertRowid, taleIds[4], new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
  db.prepare('INSERT INTO homework_done (homework_id, student_id, attempt_id) VALUES (?, ?, ?)').run(hw.lastInsertRowid, userIds.dinara, null);

  // A couple of starter badges for demo students
  for (const u of ['aziz', 'dinara', 'marat']) {
    db.prepare('INSERT INTO user_badges (user_id, badge_code) VALUES (?, ?)').run(userIds[u], 'first_tale');
    db.prepare('INSERT INTO user_badges (user_id, badge_code) VALUES (?, ?)').run(userIds[u], 'three_tales');
  }

  return true;
}
