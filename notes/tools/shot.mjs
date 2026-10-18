#!/usr/bin/env node
// Screenshot a page at 390x844 @2x in headless Chromium over the DevTools protocol, after the page has
// really settled (real time, so Reanimated's entering animations finish; virtual time freezes them).
// Usage: node shot.mjs <url> <out.png> [waitMs=2500] [js to run before the shot]
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, waitMs = '2500', js = ''] = process.argv.slice(2);
const base = join(homedir(), '.cache/ms-playwright');
const dir = readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const sub = readdirSync(join(base, dir)).find((d) => d.startsWith('chrome-headless-shell'));
const bin = join(base, dir, sub, 'chrome-headless-shell');

const proc = spawn(bin, ['--no-sandbox', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'shot-'))}`, 'about:blank']);
const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  proc.stderr.on('data', (d) => {
    buf += d;
    const m = buf.match(/ws:\/\/\S+/);
    if (m) resolve(m[0]);
  });
  setTimeout(() => reject(new Error('chromium did not start')), 15000);
});

const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) listeners.forEach((l) => l(msg));
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  await s('Page.enable');
  await s('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false });
  const loaded = new Promise((r) => listeners.push((m) => m.method === 'Page.loadEventFired' && m.sessionId === sessionId && r()));
  await s('Page.navigate', { url });
  await loaded;
  // wait until the app has rendered something, then the settle time
  for (let i = 0; i < 100; i++) {
    const { result } = await s('Runtime.evaluate', { expression: 'document.body.innerText.trim().length + document.images.length' });
    if (result.value > 0) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  await new Promise((r) => setTimeout(r, Number(waitMs)));
  if (js) {
    const { result, exceptionDetails } = await s('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) console.error('js error:', exceptionDetails.exception?.description ?? exceptionDetails.text);
    else if (result.value !== undefined) console.log(typeof result.value === 'string' ? result.value : JSON.stringify(result.value));
    await new Promise((r) => setTimeout(r, 800));
  }
  if (process.env.TEXTS_OUT) {
    // every rendered text (RN-web Text = element with its own text node) and input, with its font
    const expr = `JSON.stringify([...document.querySelectorAll('body *')].filter(e => {
      if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') return true;
      return [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    }).map(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e);
      if (!r.width || c.visibility === 'hidden') return null;
      return { text: (e.value ?? [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('')).trim() || e.placeholder || '',
        x: r.left, y: r.top, w: r.width, h: r.height, family: c.fontFamily, size: parseFloat(c.fontSize), weight: c.fontWeight,
        spacing: c.letterSpacing, lineHeight: c.lineHeight, color: c.color, opacity: c.opacity };
    }).filter(Boolean))`;
    const { result } = await s('Runtime.evaluate', { expression: expr, returnByValue: true });
    writeFileSync(process.env.TEXTS_OUT, result.value);
  }
  const { data } = await s('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(data, 'base64'));
} finally {
  ws.close();
  proc.kill();
}
