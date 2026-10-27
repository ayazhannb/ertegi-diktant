// JWT auth helpers + role guards.
import jwt from 'jsonwebtoken';
import config from './config.js';
import db from './db.js';

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtTtl });
}

export function publicUser(row) {
  if (!row) return null;
  let settings = {};
  try { settings = JSON.parse(row.settings || '{}'); } catch { /* keep {} */ }
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    avatar: row.avatar,
    settings,
    xp: row.xp,
    streak: row.streak,
    onboardingDone: !!row.onboarding_done,
  };
}

// req.user = user row; optional: requireRole('teacher') allows teacher+admin.
export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Авторизация қажет' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'Пайдаланушы табылмады' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Мерзімі аяқталған, қайта кіріңіз' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Бұл әрекетке рұқсат жоқ' });
    }
    next();
  };
}

// Tiny in-memory rate limiter for auth endpoints (50 req / 15 min / ip;
// classrooms share one IP with many children).
export function rateLimit(max = 50, windowMs = 15 * 60 * 1000) {
  const hits = new Map();
  return (req, res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: 'Сұраныстар тым көп, сәтін күйіңіз' });
    arr.push(now);
    hits.set(ip, arr);
    next();
  };
}
