// Headless Chrome CDP screenshot helper: node tools/shot.mjs <url> <out.png> [width] [height] [token]
// Uses Chrome remote debugging. Optionally injects an ed_token into localStorage first.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [,, url, out, w = '1280', h = '900', token] = process.argv;

const tmpProfile = fs.mkdtempSync(`${os.tmpdir()}\chrome-prof-`);
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=9333`,
  `--user-data-dir=${tmpProfile}`,
  '--no-first-run', '--no-default-browser-check',
  '--disable-gpu',
  '--lang=kk-KZ',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpJson(path) {
  const res = await fetch(`http://127.0.0.1:9333${path}`);
  return res.json();
}

let ws;
let idc = 0;
const pending = new Map();
function send(method, params = {}, sessionId) {
  const id = ++idc;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

let started = false;
for (let i = 0; i < 50 && !started; i++) {
  await sleep(400);
  try {
    const targets = await httpJson('/json/list');
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
      }
    };
    started = true;
  } catch { /* retry */ }
}
if (!started) { console.error('chrome did not start'); chrome.kill(); process.exit(1); }

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile: false });

if (token) {
  await send('Runtime.evaluate', { expression: `localStorage.setItem('ed_token', ${JSON.stringify(token)})` });
}
await send('Page.navigate', { url });
await sleep(4500); // let fonts + app render
const { data } = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(out, Buffer.from(data, 'base64'));
console.log(`saved ${out}`);
ws.close();
chrome.kill();
process.exit(0);
