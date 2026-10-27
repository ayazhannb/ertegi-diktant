// /api/tales — public library + single tale with segments.
import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();

function taleListRow(t, best, resume, homeworkTaleIds) {
  return {
    id: t.id,
    title: t.title,
    level: t.level,
    category: t.category,
    ageMin: t.age_min,
    ageMax: t.age_max,
    description: t.description,
    thumbnail: t.thumbnail,
    duration: t.duration,
    youtubeId: t.youtube_id,
    segmentCount: t.seg_count,
    best: best || null,
    resume: resume || null,
    isHomework: homeworkTaleIds.has(t.id),
  };
}

r.get('/', (req, res) => {
  const { level, category, q } = req.query;
  const user = req.user || null;

  const where = ['t.active = 1'];
  const params = [];
  if (level && ['1', '2', '3'].includes(String(level))) { where.push('t.level = ?'); params.push(Number(level)); }
  if (category) { where.push('t.category = ?'); params.push(category); }
  if (q) { where.push('(t.title LIKE ? OR t.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

  const tales = db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM segments s WHERE s.tale_id = t.id) AS seg_count
    FROM tales t WHERE ${where.join(' AND ')}
    ORDER BY t.level, t.title`).all(...params);

  let bestMap = new Map();
  let resumeMap = new Map();
  const hwIds = new Set();
  if (user) {
    for (const row of db.prepare(`
      SELECT tale_id, MAX(stars) AS stars, MAX(score) AS score
      FROM attempts WHERE user_id = ? AND status = 'finished' GROUP BY tale_id`).all(user.id)) {
      bestMap.set(row.tale_id, { stars: row.stars, score: row.score });
    }
    for (const row of db.prepare(`
      SELECT tale_id, id AS attempt_id, current_segment, segment_count
      FROM attempts WHERE user_id = ? AND status = 'active'`).all(user.id)) {
      resumeMap.set(row.tale_id, { attemptId: row.attempt_id, segment: row.current_segment, count: row.segment_count });
    }
    // homework for any class the user belongs to
    const hwRows = db.prepare(`
      SELECT h.tale_id FROM homework h
      JOIN class_members cm ON cm.class_id = h.class_id
      JOIN classes c ON c.id = h.class_id
      WHERE cm.user_id = ? AND (c.teacher_id != ? OR ? = 'teacher' OR ? = 'admin')`).all(user.id, user.id, user.role, user.role);
    for (const row of hwRows) hwIds.add(row.tale_id);
  }

  res.json({ tales: tales.map((t) => taleListRow(t, bestMap.get(t.id), resumeMap.get(t.id), hwIds)) });
});

r.get('/:id', (req, res) => {
  const tale = db.prepare('SELECT * FROM tales WHERE id = ? AND active = 1').get(req.params.id);
  if (!tale) return res.status(404).json({ error: 'Ертегі табылмады' });
  const segments = db.prepare('SELECT pos, start_sec, end_sec, text FROM segments WHERE tale_id = ? ORDER BY pos').all(tale.id);
  let resume = null;
  if (req.user) {
    const active = db.prepare(`
      SELECT id, current_segment, segment_count FROM attempts
      WHERE user_id = ? AND tale_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`).get(req.user.id, tale.id);
    if (active) resume = { attemptId: active.id, segment: active.current_segment, count: active.segment_count };
  }
  res.json({
    tale: {
      id: tale.id, title: tale.title, level: tale.level, category: tale.category,
      description: tale.description, thumbnail: tale.thumbnail, duration: tale.duration, youtubeId: tale.youtube_id,
    },
    segments,
    resume,
  });
});

export default r;
