// /api/auth/* — registration, login, guest, profile.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { signToken, publicUser, requireAuth, rateLimit } from '../auth.js';
import { BADGES, levelFor } from '../badges.js';

const r = Router();
const rl = rateLimit(20);
const AVATARS = ['fox', 'bear', 'bird', 'cat', 'horse', 'sun'];

const usernameRe = /^[a-zA-Z0-9_]{3,20}$/;

function userWithBadges(user) {
  const earned = db.prepare('SELECT badge_code, earned_at FROM user_badges WHERE user_id = ?').all(user.id);
  const codes = new Set(earned.map((e) => e.badge_code));
  return {
    ...publicUser(user),
    level: levelFor(user.xp),
    badges: BADGES.map((b) => ({ ...b, earnedAt: codes.has(b.code) ? earned.find((e) => e.badge_code === b.code).earned_at : null })),
  };
}

r.post('/register', rl, (req, res) => {
  const { name, username, password, avatar } = req.body || {};
  const uname = String(username || '').trim().toLowerCase();
  if (!name || String(name).trim().length < 2) return res.status(400).json({ error: 'Атыңды жазып шық' });
  if (!usernameRe.test(uname)) return res.status(400).json({ error: 'Логин: 3–20 таңба, латын әріптері/сан' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Құпия сөз кемінде 6 таңба болуы керек' });
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(uname);
  if (existing) return res.status(409).json({ error: 'Бұл логин бос емес, басқасын таңда' });
  const info = db.prepare(`
    INSERT INTO users (name, username, password_hash, role, avatar)
    VALUES (?, ?, ?, 'student', ?)`).run(String(name).trim().slice(0, 40), uname, bcrypt.hashSync(String(password), 10), AVATARS.includes(avatar) ? avatar : 'fox');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ token: signToken(user), user: userWithBadges(user) });
});

r.post('/login', rl, (req, res) => {
  const { username, password } = req.body || {};
  const uname = String(username || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(uname);
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Логин немесе құпия сөз дұрыс емес' });
  }
  res.json({ token: signToken(user), user: userWithBadges(user) });
});

// Guest mode: creates a temporary account for quick tries (e.g. the jury).
r.post('/guest', rl, (req, res) => {
  const n = Math.floor(1000 + Math.random() * 9000);
  const uname = `qonak${n}`;
  const info = db.prepare(`
    INSERT INTO users (name, username, password_hash, role, avatar, onboarding_done)
    VALUES (?, ?, ?, 'guest', 'fox', 1)`).run(`Қонақ ${n}`, uname, bcrypt.hashSync(`guest${Date.now()}`, 10));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ token: signToken(user), user: userWithBadges(user) });
});

r.get('/me', requireAuth, (req, res) => {
  res.json({ user: userWithBadges(req.user) });
});

r.patch('/me', requireAuth, (req, res) => {
  const b = req.body || {};
  const user = req.user;
  if (b.name && typeof b.name === 'string' && b.name.trim().length >= 2) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(b.name.trim().slice(0, 40), user.id);
  }
  if (b.avatar && AVATARS.includes(b.avatar)) {
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(b.avatar, user.id);
  }
  if (b.settings && typeof b.settings === 'object') {
    const allowed = { theme: null, textSize: null, dyslexia: null, sound: null, defaultSpeed: null };
    for (const k of Object.keys(allowed)) if (b.settings[k] !== undefined) allowed[k] = b.settings[k];
    db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(JSON.stringify(allowed), user.id);
  }
  if (b.onboarding_done === 1) {
    db.prepare('UPDATE users SET onboarding_done = 1 WHERE id = ?').run(user.id);
  }
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ user: userWithBadges(fresh) });
});

export default r;
