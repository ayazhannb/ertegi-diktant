// /api/attempts — start / resume / progress / finish a tale.
import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { computeResult } from '../check.js';
import { BADGES } from '../badges.js';

const r = Router();
r.use(requireAuth);

// Start a new attempt (or return the existing active one).
r.post('/tales/:id/start', (req, res) => {
  const tale = db.prepare('SELECT * FROM tales WHERE id = ? AND active = 1').get(req.params.id);
  if (!tale) return res.status(404).json({ error: 'Ертегі табылмады' });
  const segs = db.prepare('SELECT COUNT(*) AS n FROM segments WHERE tale_id = ?').get(tale.id).n;
  const existing = db.prepare(`
    SELECT id, current_segment, segment_count FROM attempts
    WHERE user_id = ? AND tale_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`).get(req.user.id, tale.id);
  if (existing) {
    return res.json({ attempt: existing, resumed: true });
  }
  const info = db.prepare(`
    INSERT INTO attempts (user_id, tale_id, segment_count, current_segment) VALUES (?, ?, ?, 0)`)
    .run(req.user.id, tale.id, segs);
  res.json({ attempt: { id: info.lastInsertRowid, current_segment: 0, segment_count: segs }, resumed: false });
});

// Save resume point.
r.post('/:id/progress', (req, res) => {
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ? AND user_id = ? AND status = \'active\'').get(req.params.id, req.user.id);
  if (!attempt) return res.status(404).json({ error: 'Жаттығу табылмады' });
  const seg = Math.max(0, Math.min(Number(req.body?.segment) || 0, attempt.segment_count - 1));
  db.prepare('UPDATE attempts SET current_segment = ? WHERE id = ?').run(seg, attempt.id);
  res.json({ ok: true });
});

function awardBadge(userId, code) {
  const info = db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_code) VALUES (?, ?)').run(userId, code);
  if (info.changes > 0) {
    const b = BADGES.find((x) => x.code === code);
    if (b) console.log(`[badge] ${code} → user ${userId}`);
  }
}

r.post('/:id/finish', (req, res) => {
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ? AND user_id = ? AND status = \'active\'').get(req.params.id, req.user.id);
  if (!attempt) return res.status(404).json({ error: 'Жаттығу табылмады' });
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const letterErrors = req.body?.letterErrors && typeof req.body.letterErrors === 'object' ? req.body.letterErrors : {};

  const tx = db.transaction(() => {
    for (const a of answers.slice(0, 200)) {
      db.prepare(`INSERT INTO attempt_answers (attempt_id, segment_pos, attempts, status, hint_level, words_total, words_correct, words_wrong)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        attempt.id,
        Math.max(0, Math.min(Number(a.segment_pos) || 0, attempt.segment_count - 1)),
        Math.max(1, Math.min(Number(a.attempts) || 1, 3)),
        a.status === 'skipped' ? 'skipped' : 'correct',
        Math.max(0, Math.min(Number(a.hint_level) || 0, 3)),
        Math.max(0, Number(a.words_total) || 0),
        Math.max(0, Number(a.words_correct) || 0),
        JSON.stringify(Array.isArray(a.words_wrong) ? a.words_wrong.slice(0, 30).map((w) => String(w).slice(0, 40).toLowerCase()) : [])
      );
    }
    const res1 = computeResult(answers);
    db.prepare(`
      UPDATE attempts SET status='finished', finished_at=datetime('now'), score=?, stars=?, accuracy=?,
      hints_used=?, words_total=?, words_correct=?, skipped=?, letter_errors=? WHERE id=?`)
      .run(res1.score, res1.stars, res1.accuracy, res1.hintsUsed, res1.wordsTotal, res1.wordsCorrect, res1.skipped, JSON.stringify(letterErrors), attempt.id);

    // dictionary: add wrong words
    for (const a of answers) {
      let wrong = [];
      try { wrong = a.words_wrong || []; } catch { wrong = []; }
      for (const w of wrong) {
        db.prepare(`
          INSERT INTO dictionary_words (user_id, word, example, times_wrong, last_seen)
          VALUES (?, ?, ?, 1, datetime('now'))
          ON CONFLICT(user_id, word) DO UPDATE SET times_wrong = times_wrong + 1, last_seen = datetime('now')`)
          .run(req.user.id, String(w).slice(0, 40).toLowerCase(), String(a.example || '').slice(0, 200));
      }
    }

    // xp, streak, badges
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const today = new Date().toISOString().slice(0, 10);
    let streak = user.streak;
    if (user.last_active_date !== today) {
      const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      streak = user.last_active_date === yest ? user.streak + 1 : 1;
    }
    const newXp = user.xp + res1.xpGain;
    db.prepare('UPDATE users SET xp = ?, streak = ?, last_active_date = ? WHERE id = ?').run(newXp, streak, today, req.user.id);

    const finishedCount = db.prepare(`SELECT COUNT(*) AS n FROM attempts WHERE user_id = ? AND status = 'finished'`).get(req.user.id).n;
    const newBadges = [];
    const tryBadge = (code) => {
      const info = db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_code) VALUES (?, ?)').run(req.user.id, code);
      if (info.changes > 0) newBadges.push(BADGES.find((b) => b.code === code));
    };
    if (finishedCount >= 1) tryBadge('first_tale');
    if (finishedCount >= 3) tryBadge('three_tales');
    if (finishedCount >= 10) tryBadge('ten_tales');
    if (res1.accuracy >= 100) tryBadge('perfect_tale');
    if (streak >= 3) tryBadge('streak3');
    if (streak >= 7) tryBadge('streak7');
    const learned = db.prepare('SELECT COUNT(*) AS n FROM dictionary_words WHERE user_id = ? AND learned = 1').get(req.user.id).n;
    if (learned >= 5) tryBadge('dict5');
    // q_master: no қ/к mistakes in the last 3 finished attempts
    const last3 = db.prepare(`SELECT letter_errors FROM attempts WHERE user_id = ? AND status='finished' ORDER BY id DESC LIMIT 3`).all(req.user.id);
    if (last3.length >= 3 && last3.every((row) => {
      try { return !((JSON.parse(row.letter_errors) || {})['қ/к']); } catch { return false; }
    })) tryBadge('q_master');

    // homework completion
    const hw = db.prepare(`
      SELECT h.id FROM homework h
      JOIN class_members cm ON cm.class_id = h.class_id
      WHERE h.tale_id = ? AND cm.user_id = ? LIMIT 1`).get(attempt.tale_id, req.user.id);
    if (hw) {
      db.prepare('INSERT OR IGNORE INTO homework_done (homework_id, student_id, attempt_id) VALUES (?, ?, ?)').run(hw.id, req.user.id, attempt.id);
    }

    return { ...res1, newBadges: newBadges.filter(Boolean).map((b) => ({ code: b.code, emoji: b.emoji, name: b.name, desc: b.desc })), streak };
  });

  const out = tx();
  res.json(out);
});

export default r;
