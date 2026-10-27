// Headless Chrome CDP screenshot + console capture.
// node tools/shot2.mjs <url> <out.png> [w] [h] [token] [waitMs]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [,, url, out, w = '1280', h = '900', token, waitMs = '5000'] = process.argv;

const tmpProfile = fs.mkdtempSync(`${os.tmpdir()}\\chrome-prof-`);
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9334',
  `--user-data-dir=${tmpProfile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--lang=kk-KZ',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const consoleLines = [];

let ws; let idc = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++idc;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

let started = false;
for (let i = 0; i < 50 && !started; i++) {
  await sleep(400);
  try {
    const res = await fetch('http://127.0.0.1:9334/json/list');
    const targets = await res.json();
    const page = targets.find((t) => t.type === 'page');
    if (!page) continue;
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res2, rej) => { ws.onopen = res2; ws.onerror = rej; });
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        consoleLines.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      } else if (msg.method === 'Runtime.exceptionThrown') {
        consoleLines.push('EXCEPTION: ' + (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || ''));
      }
    };
    started = true;
  } catch { /* retry */ }
}
if (!started) { console.error('chrome did not start'); chrome.kill(); process.exit(1); }

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile: false });
if (token) await send('Runtime.evaluate', { expression: `localStorage.setItem('ed_token', ${JSON.stringify(token)})` });
await send('Page.navigate', { url });
await sleep(Number(waitMs));
const { data } = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(out, Buffer.from(data, 'base64'));
console.log(`saved ${out}`);
if (consoleLines.length) {
  console.log('--- console ---');
  for (const l of consoleLines.slice(0, 40)) console.log(l);
} else {
  console.log('--- console: (empty) ---');
}
ws.close();
chrome.kill();
process.exit(0);
