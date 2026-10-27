// Robust headless CDP screenshot: navigate to app origin first, inject token, reload, capture.
// node tools/shot3.mjs <path> <out.png> [w] [h] [username] [password] [waitMs]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:4000';
const [,, path = '/', out, w = '1280', h = '900', uname, pass, waitMs = '6000'] = process.argv;

const tmpProfile = fs.mkdtempSync(`${os.tmpdir()}\\chrome-prof-`);
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9335',
  `--user-data-dir=${tmpProfile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--lang=kk-KZ',
  BASE + '/#/login',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws; let idc = 0; const pending = new Map(); const consoleLines = [];
function send(method, params = {}) {
  const id = ++idc;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
let started = false;
for (let i = 0; i < 60 && !started; i++) {
  await sleep(400);
  try {
    const targets = await (await fetch('http://127.0.0.1:9335/json/list')).json();
    const page = targets.find((t) => t.type === 'page');
    if (!page) continue;
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        consoleLines.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      } else if (msg.method === 'Runtime.exceptionThrown') {
        consoleLines.push('EXC: ' + (msg.params.exceptionDetails?.exception?.description || ''));
      }
    };
    started = true;
  } catch { /* retry */ }
}
if (!started) { console.error('chrome did not start'); chrome.kill(); process.exit(1); }

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile: false });
await sleep(2500); // app origin ready

if (uname && pass) {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: uname, password: pass }),
  });
  const j = await r.json();
  if (!j.token) { console.error('LOGIN FAILED', r.status, JSON.stringify(j)); chrome.kill(); process.exit(2); }
  await send('Runtime.evaluate', { expression: `localStorage.setItem('ed_token', ${JSON.stringify(j.token)})` });
}
// reload so the app mounts WITH the token (user loads inside React context)
await send('Page.reload');
await sleep(4500);
// now the router knows the user → hash change will not be bounced (with retry)
for (let attempt = 0; attempt < 4; attempt++) {
  await send('Runtime.evaluate', { expression: `location.hash = ${JSON.stringify('#' + path)}` });
  await sleep(Number(waitMs));
  const href = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
  if (href.result.value.includes('#' + path) || (path === '/' && /#\/(login)?$/.test(href.result.value.split('#')[1] || '/'))) break;
}
const { data } = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(out, Buffer.from(data, 'base64'));
const finalHref = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
const finalH1 = await send('Runtime.evaluate', { expression: `document.querySelector('h1')?.textContent || 'NO H1'`, returnByValue: true });
console.log(`saved ${out} [${finalHref.result.value}] H1: ${finalH1.result.value}`);
if (consoleLines.length) { console.log('--- console ---'); consoleLines.slice(0, 30).forEach((l) => console.log(l)); }
ws.close(); chrome.kill(); process.exit(0);
