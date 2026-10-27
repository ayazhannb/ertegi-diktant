// Application entry: API + static frontend.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import config from './config.js';
import './db.js'; // init schema
import { seedIfEmpty } from './seed.js';
import authRoutes from './routes/auth.js';
import talesRoutes from './routes/tales.js';
import attemptsRoutes from './routes/attempts.js';
import progressRoutes from './routes/progress.js';
import teacherRoutes from './routes/teacher.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', true);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// --- API ---
app.get('/api/health', (req, res) => res.json({ ok: true, name: 'ertegi-diktant', time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/tales', talesRoutes);
app.use('/api/attempts', attemptsRoutes);
app.use('/api', progressRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/admin', adminRoutes);

// Friendly 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Тапсырма табылмады' }));

// --- Static frontend (built by Vite) ---
const dist = path.resolve(__dirname, '../../client/dist');
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || !fs.existsSync(path.join(dist, 'index.html'))) return next();
  // fall through to static/SPA below
  next();
});
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: 'index.html' }));
}
app.get(/^\/(?!api\/).*/, (req, res) => {
  const indexFile = path.join(dist, 'index.html');
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  res.type('text/plain').send('Frontend build табылмады. Алдымен: npm run build (client/dist)');
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('[api error]', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: 'Қате шықты, қайталап көр' });
});

seedIfEmpty();

app.listen(config.port, () => {
  console.log(`«Ертегі диктант» сервері істеді: http://localhost:${config.port}`);
});
