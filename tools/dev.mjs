// Dev runner: starts the API server (port 4000) and Vite dev server (port 5173) together.
// Usage: npm run dev  (from the project root). Ctrl+C stops both.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const kids = [];

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const k of kids) { try { k.kill('SIGTERM'); } catch { /* ignore */ } }
  setTimeout(() => process.exit(code), 800);
}

function start(tag, script) {
  const p = spawn('npm', ['run', script], {
    cwd: root,
    shell: isWin, // npm is npm.cmd on Windows
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  kids.push(p);
  const pad = (s) => (s || '').split('\n').map((l) => `[${tag}] ${l}`).join('\n');
  const forward = (stream) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line.trim()) process.stdout.write(pad(line) + '\n');
      }
    });
  };
  forward(p.stdout);
  forward(p.stderr);
  p.on('exit', (code) => {
    console.log(`[${tag}] process exited (code ${code}); stopping the other…`);
    shutdown(code ?? 0);
  });
}

start('api ', 'dev:server');
start('web', 'dev:client');

console.log('────────────────────────────────────────────');
console.log('  API   → http://localhost:4000');
console.log('  Web   → http://localhost:5173   (hot reload)');
console.log('  Ctrl+C — остановить оба');
console.log('────────────────────────────────────────────');

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
