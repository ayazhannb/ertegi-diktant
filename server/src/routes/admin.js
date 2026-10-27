// /api/admin/* — tale + segment management (admin).
import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { thumb, CATEGORIES } from '../tales-seed.js';

const r = Router();
r.use(requireAuth, requireRole('admin'));

const UA = 'Mozilla/5.0 (compatible; ErtegiDiktant/1.0)';

// Extract YouTube id from any URL form.
export function extractYouTubeId(input) {
  const s = String(input || '').trim();
  const m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}

async function fetchVideoMeta(youtubeId) {
  // oEmbed: title/author/thumbnail (no API key needed).
  const om = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}&format=json`,
    { headers: { 'user-agent': UA } }
  );
  const meta = om.ok ? await om.json() : {};
  // duration from the watch page
  let duration = 0;
  try {
    const wp = await fetch(`https://www.youtube.com/watch?v=${youtubeId}`, { headers: { 'user-agent': UA, 'accept-language': 'kk;q=0.9' } });
    const html = await wp.text();
    const m = html.match(/var ytInitialPlayerResponse = (\{.+?\});(?:var |<\/script>)/s);
    if (m) duration = JSON.parse(m[1]).videoDetails?.lengthSeconds || 0;
  } catch { /* non-fatal */ }
  return {
    title: meta.title || '',
    author: meta.author_name || '',
    thumbnail: meta.thumbnail_url || thumb(youtubeId),
    duration,
  };
}

r.get('/tales', (req, res) => {
  const tales = db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM segments s WHERE s.tale_id = t.id) AS seg_count
    FROM tales t ORDER BY t.id`).all();
  res.json({ tales, categories: CATEGORIES });
});

// Suggest sentence split for the segment editor (rule-based; human confirms).
r.post('/tales/:id/split', (req, res) => {
  const tale = db.prepare('SELECT id FROM tales WHERE id = ?').get(req.params.id);
  if (!tale) return res.status(404).json({ error: 'Ертегі табылмады' });
  const text = String(req.body?.text || '');
  // Split on sentence-ending punctuation, keep the punctuation, merge tiny fragments.
  const raw = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  const sentences = [];
  for (const s of raw) {
    if (sentences.length && s.split(/\s+/).length < 2) sentences[sentences.length - 1] += ' ' + s;
    else sentences.push(s);
  }
  res.json({ sentences });
});

r.post('/tales', async (req, res) => {
  try {
    const { url, title, level, category, age_min, age_max, description } = req.body || {};
    const youtubeId = extractYouTubeId(url);
    if (!youtubeId) return res.status(400).json({ error: 'YouTube сілтемесін дұрыс жібер' });
    const existing = db.prepare('SELECT id FROM tales WHERE youtube_id = ?').get(youtubeId);
    if (existing) return res.status(409).json({ error: 'Бұл бейне қазірден бар' });
    const meta = await fetchVideoMeta(youtubeId);
    const info = db.prepare(`
      INSERT INTO tales (youtube_id, title, level, category, age_min, age_max, description, thumbnail, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      youtubeId,
      String(title || meta.title || 'Жаңа ертегі').trim().slice(0, 120),
      Math.max(1, Math.min(3, Number(level) || 1)),
      String(category || 'Халық ертегісі').slice(0, 60),
      Math.max(4, Math.min(18, Number(age_min) || 7)),
      Math.max(4, Math.min(18, Number(age_max) || 12)),
      String(description || '').slice(0, 400),
      meta.thumbnail,
      meta.duration || 0
    );
    res.json({ id: info.lastInsertRowid, meta });
  } catch (e) {
    console.error('admin/tales create error', e);
    res.status(502).json({ error: 'YouTube мәліметін ала алмадық, қайталап көр' });
  }
});

r.patch('/tales/:id', (req, res) => {
  const tale = db.prepare('SELECT * FROM tales WHERE id = ?').get(req.params.id);
  if (!tale) return res.status(404).json({ error: 'Ертегі табылмады' });
  const b = req.body || {};
  db.prepare(`
    UPDATE tales SET title=?, level=?, category=?, age_min=?, age_max=?, description=?, active=? WHERE id=?`).run(
    String(b.title ?? tale.title).slice(0, 120),
    Math.max(1, Math.min(3, Number(b.level) ?? tale.level)),
    String(b.category ?? tale.category).slice(0, 60),
    Math.max(4, Math.min(18, Number(b.age_min) ?? tale.age_min)),
    Math.max(4, Math.min(18, Number(b.age_max) ?? tale.age_max)),
    String(b.description ?? tale.description).slice(0, 400),
    b.active === 0 || b.active === false ? 0 : 1,
    tale.id
  );
  res.json({ ok: true });
});

r.delete('/tales/:id', (req, res) => {
  const tale = db.prepare('SELECT id FROM tales WHERE id = ?').get(req.params.id);
  if (!tale) return res.status(404).json({ error: 'Ертегі табылмады' });
  db.prepare('DELETE FROM tales WHERE id = ?').run(tale.id);
  res.json({ ok: true });
});

r.get('/tales/:id/segments', (req, res) => {
  const tale = db.prepare('SELECT * FROM tales WHERE id = ?').get(req.params.id);
  if (!tale) return res.status(404).json({ error: 'Ертегі табылмады' });
  const segments = db.prepare('SELECT id, pos, start_sec, end_sec, text FROM segments WHERE tale_id = ? ORDER BY pos').all(tale.id);
  res.json({ segments, duration: tale.duration });
});

r.post('/tales/:id/segments', (req, res) => {
  const tale = db.prepare('SELECT * FROM tales WHERE id = ?').get(req.params.id);
  if (!tale) return res.status(404).json({ error: 'Ертегі табылмады' });
  const list = Array.isArray(req.body?.segments) ? req.body.segments : [];
  const clean = list.slice(0, 120).map((s, i) => ({
    pos: i,
    start_sec: Math.max(0, Number(s.start_sec) || 0),
    end_sec: Math.max(0, Number(s.end_sec) || 0),
    text: String(s.text || '').trim().slice(0, 300),
  })).filter((s) => s.text && s.end_sec > s.start_sec);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM segments WHERE tale_id = ?').run(tale.id);
    for (const s of clean) {
      db.prepare('INSERT INTO segments (tale_id, pos, start_sec, end_sec, text) VALUES (?, ?, ?, ?, ?)').run(tale.id, s.pos, s.start_sec, s.end_sec, s.text);
    }
  });
  tx();
  res.json({ ok: true, count: clean.length });
});

// Proxy video metadata for the admin "auto-fill" button.
r.post('/yt-info', async (req, res) => {
  try {
    const youtubeId = extractYouTubeId(req.body?.url);
    if (!youtubeId) return res.status(400).json({ error: 'YouTube сілтемесін дұрыс жібер' });
    const meta = await fetchVideoMeta(youtubeId);
    res.json({ youtubeId, ...meta });
  } catch {
    res.status(502).json({ error: 'YouTube мәліметін ала алмадық' });
  }
});

export default r;
