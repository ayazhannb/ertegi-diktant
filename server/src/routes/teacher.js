// /api/teacher/* — classes, homework, student progress, analytics (teacher|admin).
import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const r = Router();
r.use(requireAuth, requireRole('teacher', 'admin'));

r.get('/classes', (req, res) => {
  const classes = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM class_members cm WHERE cm.class_id = c.id) AS members
    FROM classes c WHERE c.teacher_id = ? ORDER BY c.name`).all(req.user.id);
  res.json({ classes });
});

r.post('/classes', (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: 'Сынып атауы қажет' });
  const info = db.prepare('INSERT INTO classes (name, teacher_id) VALUES (?, ?)').run(name, req.user.id);
  res.json({ id: info.lastInsertRowid, name });
});

r.delete('/classes/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: 'Сынып табылмады' });
  db.prepare('DELETE FROM classes WHERE id = ?').run(c.id);
  res.json({ ok: true });
});

r.post('/classes/:id/add', (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: 'Сынып табылмады' });
  const uname = String(req.body?.username || '').trim().toLowerCase();
  const student = db.prepare(`
    SELECT * FROM users WHERE username = ? AND role IN ('student','guest')`).get(uname);
  if (!student) return res.status(404).json({ error: 'Мұндай оқушы жоқ' });
  db.prepare('INSERT OR IGNORE INTO class_members (class_id, user_id) VALUES (?, ?)').run(c.id, student.id);
  res.json({ ok: true, student: { id: student.id, name: student.name, username: student.username } });
});

r.delete('/classes/:id/members/:userId', (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: 'Сынып табылмады' });
  db.prepare('DELETE FROM class_members WHERE class_id = ? AND user_id = ?').run(c.id, req.params.userId);
  res.json({ ok: true });
});

r.get('/classes/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: 'Сынып табылмады' });
  const members = db.prepare(`
    SELECT u.id, u.name, u.username, u.avatar,
      (SELECT COUNT(*) FROM attempts a WHERE a.user_id = u.id AND a.status = 'finished') AS tales_done,
      (SELECT ROUND(AVG(a.accuracy), 1) FROM attempts a WHERE a.user_id = u.id AND a.status = 'finished') AS avg_accuracy,
      (SELECT a.xp FROM users a WHERE a.id = u.id) AS xp
    FROM class_members cm JOIN users u ON u.id = cm.user_id
    WHERE cm.class_id = ? ORDER BY u.name`).all(c.id);
  const homework = db.prepare(`
    SELECT h.*, t.title FROM homework h JOIN tales t ON t.id = h.tale_id
    WHERE h.class_id = ? ORDER BY h.assigned_at DESC`).all(c.id);
  res.json({ class: { id: c.id, name: c.name }, members, homework });
});

r.post('/homework', (req, res) => {
  const { class_id, tale_id, due_date } = req.body || {};
  const c = db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?').get(Number(class_id), req.user.id);
  if (!c) return res.status(404).json({ error: 'Сынып табылмады' });
  const tale = db.prepare('SELECT * FROM tales WHERE id = ? AND active = 1').get(Number(tale_id));
  if (!tale) return res.status(404).json({ error: 'Ертегі табылмады' });
  const due = /^\d{4}-\d{2}-\d{2}$/.test(String(due_date)) ? due_date : new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const info = db.prepare('INSERT INTO homework (class_id, tale_id, due_date) VALUES (?, ?, ?)').run(c.id, tale.id, due);
  res.json({ id: info.lastInsertRowid });
});

r.delete('/homework/:id', (req, res) => {
  const hw = db.prepare(`
    SELECT h.* FROM homework h JOIN classes c ON c.id = h.class_id
    WHERE h.id = ? AND c.teacher_id = ?`).get(req.params.id, req.user.id);
  if (!hw) return res.status(404).json({ error: 'Тапсырма табылмады' });
  db.prepare('DELETE FROM homework WHERE id = ?').run(hw.id);
  res.json({ ok: true });
});

// Class analytics: hardest words + letter confusion stats.
r.get('/classes/:id/analytics', (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: 'Сынып табылмады' });
  const rows = db.prepare(`
    SELECT aa.words_wrong
    FROM attempt_answers aa
    JOIN attempts a ON a.id = aa.attempt_id
    JOIN class_members cm ON cm.user_id = a.user_id
    WHERE cm.class_id = ?`).all(c.id);
  const wordCounts = {};
  for (const row of rows) {
    let wrong = [];
    try { wrong = JSON.parse(row.words_wrong || '[]'); } catch { wrong = []; }
    for (const w of wrong) wordCounts[w] = (wordCounts[w] || 0) + 1;
  }
  // letter errors from attempts
  const letterCounts = {};
  const attRows = db.prepare(`
    SELECT a.letter_errors FROM attempts a JOIN class_members cm ON cm.user_id = a.user_id
    WHERE cm.class_id = ? AND a.status = 'finished'`).all(c.id);
  for (const row of attRows) {
    let letters = {};
    try { letters = JSON.parse(row.letter_errors || '{}'); } catch { letters = {}; }
    for (const [k, v] of Object.entries(letters)) letterCounts[k] = (letterCounts[k] || 0) + Number(v) || 0;
  }
  const topWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, n]) => ({ word, n }));
  const topLetters = Object.entries(letterCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([letter, n]) => ({ letter, n }));
  res.json({ topWords, topLetters });
});

export default r;
