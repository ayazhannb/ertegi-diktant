// /api/progress + /api/dictionary — student stats and personal word bank.
import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth);

r.get('/progress', (req, res) => {
  const uid = req.user.id;
  const completed = db.prepare(`
    SELECT a.id, a.score, a.stars, a.accuracy, a.finished_at, a.hints_used, t.title, t.level
    FROM attempts a JOIN tales t ON t.id = a.tale_id
    WHERE a.user_id = ? AND a.status = 'finished' ORDER BY a.id DESC`).all(uid);
  const weekly = db.prepare(`
    SELECT date(finished_at) AS d, COUNT(*) AS n
    FROM attempts WHERE user_id = ? AND status = 'finished'
    AND finished_at >= datetime('now', '-7 day')
    GROUP BY date(finished_at)`).all(uid);
  const weekMap = Object.fromEntries(weekly.map((x) => [x.d, x.n]));
  const days = [];
  const dayNames = ['Жс', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб']; // JS getDay: 0=Sun
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    const iso = d.toISOString().slice(0, 10);
    days.push({ date: iso, label: dayNames[d.getDay()], count: weekMap[iso] || 0 });
  }
  const dictCount = db.prepare('SELECT COUNT(*) AS n FROM dictionary_words WHERE user_id = ?').get(uid).n;
  const learned = db.prepare('SELECT COUNT(*) AS n FROM dictionary_words WHERE user_id = ? AND learned = 1').get(uid).n;
  res.json({ completed, weekly: days, dictCount, learned });
});

r.get('/dictionary', (req, res) => {
  const words = db.prepare(`
    SELECT id, word, example, times_wrong, learned FROM dictionary_words
    WHERE user_id = ? ORDER BY learned, last_seen DESC`).all(req.user.id);
  res.json({ words });
});

r.post('/dictionary/:id/learn', (req, res) => {
  const w = db.prepare('SELECT * FROM dictionary_words WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!w) return res.status(404).json({ error: 'Сөз табылмады' });
  db.prepare('UPDATE dictionary_words SET learned = 1 WHERE id = ?').run(w.id);
  db.prepare('UPDATE users SET xp = xp + 5 WHERE id = ?').run(req.user.id);
  const learned = db.prepare('SELECT COUNT(*) AS n FROM dictionary_words WHERE user_id = ? AND learned = 1').get(req.user.id).n;
  if (learned >= 5) db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_code) VALUES (?, ?)').run(req.user.id, 'dict5');
  res.json({ ok: true });
});

r.post('/dictionary/:id/practice', (req, res) => {
  const w = db.prepare('SELECT * FROM dictionary_words WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!w) return res.status(404).json({ error: 'Сөз табылмады' });
  if (req.body?.ok === true && !w.learned) {
    db.prepare('UPDATE dictionary_words SET learned = 1 WHERE id = ?').run(w.id);
    db.prepare('UPDATE users SET xp = xp + 5 WHERE id = ?').run(req.user.id);
  }
  res.json({ ok: true });
});

export default r;
