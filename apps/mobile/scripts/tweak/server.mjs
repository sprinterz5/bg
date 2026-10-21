#!/usr/bin/env node
// Tweak: a small web page where the designer nudges the safe style values of the app (spacing, type, colours,
// sizes) without touching layout or logic. It runs next to Metro on the VPS and edits that checkout directly, so
// the web preview and the phone fast-refresh at once. "Send" turns the batch into one commit on main whose body
// lists every change (screen · what · from → to).
//
// Env: TWEAK_PORT (4848), TWEAK_REPO (repo root, default ../../.. from here), TWEAK_PUSH_URL (git URL to push to;
// unset = commit only), TWEAK_AUTHOR ("Name <email>").
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(process.env.TWEAK_REPO || join(here, '../../..'));
const MOBILE = join(REPO, 'apps/mobile');
const SRC = join(MOBILE, 'src');
const ts = createRequire(join(MOBILE, 'package.json'))('typescript');
const PORT = Number(process.env.TWEAK_PORT || 4848);
const PUSH_URL = process.env.TWEAK_PUSH_URL || '';
const [AUTHOR_NAME, AUTHOR_EMAIL] = (process.env.TWEAK_AUTHOR || 'Designer <designer@thoughts.app>').match(/^(.*?)\s*<(.*)>$/).slice(1);

// What the designer may change, with the words shown for it. Anything else (position, flex, consts, logic) is hidden.
const LABELS = {
  marginTop: 'Отступ сверху', marginBottom: 'Отступ снизу', marginLeft: 'Отступ слева', marginRight: 'Отступ справа',
  marginHorizontal: 'Отступ по бокам', marginVertical: 'Отступ сверху и снизу', margin: 'Отступ',
  paddingTop: 'Поле сверху', paddingBottom: 'Поле снизу', paddingLeft: 'Поле слева', paddingRight: 'Поле справа',
  paddingHorizontal: 'Поле по бокам', paddingVertical: 'Поле сверху и снизу', padding: 'Поле',
  gap: 'Расстояние между', rowGap: 'Расстояние между строками', columnGap: 'Расстояние между колонками',
  top: 'Позиция сверху', bottom: 'Позиция снизу', left: 'Позиция слева', right: 'Позиция справа',
  translateX: 'Сдвиг по горизонтали', translateY: 'Сдвиг по вертикали',
  width: 'Ширина', height: 'Высота', size: 'Размер',
  fontSize: 'Размер шрифта', lineHeight: 'Межстрочный', letterSpacing: 'Межбуквенный (pt)', fontWeight: 'Жирность',
  color: 'Цвет текста', backgroundColor: 'Цвет фона', borderColor: 'Цвет обводки', tintColor: 'Цвет иконки',
  borderRadius: 'Скругление', borderWidth: 'Толщина обводки', borderTopWidth: 'Обводка сверху', borderBottomWidth: 'Обводка снизу',
  opacity: 'Прозрачность',
};
const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const WEIGHTS = ['300', '400', '500', '600', '700', '800', '900'];

// Screen names for the files (the rest show their path).
const SCREENS = {
  'src/app/(tabs)/(home)/index.tsx': 'Home', 'src/components/feed-post.tsx': 'Home · пост',
  'src/components/feed-tabs.tsx': 'Home · категории', 'src/components/home-stories.tsx': 'Home · сторисы',
  'src/components/tab-bar.tsx': 'Таббар', 'src/app/article/[id].tsx': 'Статья', 'src/app/new-article.tsx': 'Новая статья',
  'src/app/notifications.tsx': 'Уведомления', 'src/app/story/[id].tsx': 'Сторис', 'src/app/(auth)/welcome.tsx': 'Welcome',
  'src/components/step-screen.tsx': 'Регистрация · экран шага', 'src/components/big-input.tsx': 'Регистрация · поле',
  'src/components/primary-button.tsx': 'Кнопка Continue',
};
const screen = (rel) => {
  const r = rel.replace(/^apps\/mobile\//, '');
  return SCREENS[r] ?? r.replace(/^src\/(app|components)\//, '').replace(/\.tsx?$/, '');
};

// ---------- finding the values ----------

const name = (n) => (n.name && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) ? n.name.text : null);
const isCreate = (n) => n && ts.isCallExpression(n) && n.expression.getText() === 'StyleSheet.create';

/** The style property a literal is the value of, or null. Only plain values count: `12`, `-3`, `a ? 1 : 2`,
 *  `X + 4`; a number inside a call (Math.max(…, 12)) or a computation is not the designer's. */
function owner(node) {
  let n = node;
  for (;;) {
    const p = n.parent;
    if (ts.isPrefixUnaryExpression(p) || ts.isParenthesizedExpression(p)) n = p;
    else if (ts.isConditionalExpression(p) && p.condition !== n) n = p;
    else if (ts.isBinaryExpression(p) && p.right === n && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(p.operatorToken.kind)) n = p;
    else break;
  }
  return ts.isPropertyAssignment(n.parent) && n.parent.initializer === n ? n.parent : null;
}

/** Group a style property belongs to: the StyleSheet key, or the JSX element of an inline style. */
function group(prop) {
  for (let p = prop.parent; p; p = p.parent) {
    if (ts.isPropertyAssignment(p) && isCreate(p.parent?.parent)) return p.name.getText();
    if (ts.isJsxAttribute(p)) return `<${p.parent.parent.tagName.getText()}>`;
    if (ts.isFunctionLike(p) || ts.isVariableStatement(p)) return null;
  }
  return null;
}

const cache = new Map();
function scan(rel) {
  const abs = join(REPO, rel);
  const mtime = statSync(abs).mtimeMs;
  const hit = cache.get(rel);
  if (hit?.mtime === mtime) return hit.items;
  const text = readFileSync(abs, 'utf8');
  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines = text.split('\n');
  const items = [];
  const seen = new Map();
  const add = (node, kind, value, prop, grp) => {
    const start = node.getStart(sf);
    const line = sf.getLineAndCharacterOfPosition(start).line;
    const base = `${grp}.${prop}`;
    const k = (seen.get(base) ?? 0) + 1;
    seen.set(base, k);
    items.push({ key: k > 1 ? `${base}#${k}` : base, group: grp, prop, label: LABELS[prop], kind, value, start, end: node.getEnd(), line: line + 1, src: lines[line].trim().slice(0, 160) });
  };
  const visit = (n) => {
    // <Icon … width={21} height={18.5} />: icon size
    if (ts.isJsxAttribute(n) && /^(width|height|size)$/.test(n.name.getText()) && n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression && ts.isNumericLiteral(n.initializer.expression)) {
      const el = n.parent.parent;
      const iconName = el.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === 'name')?.initializer;
      const tag = el.tagName.getText();
      const grp = iconName && ts.isStringLiteral(iconName) ? `<${tag} ${iconName.text}>` : `<${tag}>`;
      const prop = n.name.getText();
      add(n.initializer.expression, 'num', Number(n.initializer.expression.text), prop, grp);
      return;
    }
    let lit = null;
    let kind = null;
    let value = null;
    if (ts.isNumericLiteral(n) && !(ts.isPrefixUnaryExpression(n.parent) && n.parent.operator === ts.SyntaxKind.MinusToken)) [lit, kind, value] = [n, 'num', Number(n.text)];
    else if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand)) [lit, kind, value] = [n, 'num', -Number(n.operand.text)];
    else if (ts.isStringLiteral(n) && COLOR.test(n.text)) [lit, kind, value] = [n, 'color', n.text.toUpperCase()];
    else if (ts.isElementAccessExpression(n) && n.expression.getText() === 'INTER_FAMILIES' && ts.isStringLiteral(n.argumentExpression)) {
      const prop = owner(n);
      const grp = prop && name(prop) === 'fontFamily' && group(prop);
      if (grp) add(n.argumentExpression, 'weight', n.argumentExpression.text, 'fontWeight', grp);
      return;
    }
    if (lit) {
      const prop = owner(lit);
      const p = prop && name(prop);
      const grp = p && LABELS[p] && group(prop);
      if (grp) add(lit, kind, value, p, grp);
      if (kind === 'num' && lit !== n) return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  cache.set(rel, { mtime, items });
  return items;
}

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    if (f === '__tests__' || f === 'mock' || f.startsWith('.')) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(f)) out.push(relative(REPO, p));
  }
  return out;
}

// ---------- editing ----------

const changes = new Map(); // `${rel}|${key}` → { rel, key, prop, group, kind, from, to }
const num = (v) => String(Math.round(Number(v) * 1000) / 1000).replace(/^-0$/, '0');

function setValue(rel, key, value) {
  const item = scan(rel).find((i) => i.key === key);
  if (!item) throw new Error('Значение не найдено — обновите страницу');
  let next;
  if (item.kind === 'num') {
    if (!Number.isFinite(Number(value))) throw new Error('Нужно число');
    if (Math.abs(Number(value)) > 2000) throw new Error('Слишком большое число');
    next = num(value);
  } else if (item.kind === 'color') {
    if (!COLOR.test(value)) throw new Error('Цвет в формате #RRGGBB');
    next = value.toUpperCase();
  } else {
    if (!WEIGHTS.includes(String(value))) throw new Error('Жирность 300–900');
    next = String(value);
  }
  const abs = join(REPO, rel);
  const text = readFileSync(abs, 'utf8');
  const q = item.kind === 'num' ? '' : text[item.start];
  writeFileSync(abs, text.slice(0, item.start) + q + next + q + text.slice(item.end));
  cache.delete(rel);
  const id = `${rel}|${key}`;
  const from = changes.get(id)?.from ?? (item.kind === 'num' ? num(item.value) : item.value);
  if (from === next) changes.delete(id);
  else changes.set(id, { rel, key, prop: item.prop, label: item.label, group: item.group, kind: item.kind, from, to: next });
}

const git = (...args) =>
  new Promise((res, rej) =>
    execFile('git', ['-C', REPO, '-c', `user.name=${AUTHOR_NAME}`, '-c', `user.email=${AUTHOR_EMAIL}`, ...args], { maxBuffer: 1 << 24 }, (e, out, err) =>
      e ? rej(new Error((err || e.message).trim())) : res(out.trim())),
  );

let busy = false;
async function send(note) {
  if (busy) throw new Error('Уже отправляется');
  const list = [...changes.values()];
  if (!list.length) throw new Error('Нет изменений');
  busy = true;
  try {
    const rels = [...new Set(list.map((c) => c.rel))];
    const screens = [...new Set(list.map((c) => screen(c.rel)))].join(', ');
    const body = list.map((c) => `${screen(c.rel)} · ${c.group} · ${c.label ?? c.prop} (${c.prop}): ${c.from} → ${c.to}`).join('\n');
    await git('add', '--', ...rels);
    await git('commit', '-q', '-m', `Design tweaks: ${screens}`, '-m', (note ? note + '\n\n' : '') + body, '--', ...rels);
    if (PUSH_URL) {
      // others may have pushed meanwhile: replay on top (their edits to other lines merge cleanly)
      await git('pull', '-q', '--rebase', 'origin', 'main');
      await git('push', '-q', PUSH_URL, 'HEAD:main');
    }
    changes.clear();
    return await git('log', '--oneline', '-1');
  } finally {
    busy = false;
  }
}

function discard() {
  for (const c of [...changes.values()]) {
    try {
      setValue(c.rel, c.key, c.from);
    } catch {
      /* the line moved on */
    }
  }
  changes.clear();
}

// ---------- http ----------

function reply(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}
const safe = (rel) => {
  const abs = resolve(REPO, rel || '');
  if (!abs.startsWith(SRC + sep)) throw new Error('bad path');
  return relative(REPO, abs);
};
async function json(req) {
  let s = '';
  for await (const c of req) s += c;
  return s ? JSON.parse(s) : {};
}
const status = () => ({ changes: [...changes.values()].map((c) => ({ ...c, screen: screen(c.rel) })) });

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/^\/tweak/, '') || '/';
  try {
    if (p === '/') return reply(res, 200, readFileSync(join(here, 'index.html')), 'text/html; charset=utf-8');
    if (p === '/api/screens')
      return reply(res, 200, walk(SRC).map((rel) => ({ rel, name: screen(rel), count: scan(rel).length })).filter((f) => f.count).sort((a, b) => (SCREENS[b.rel.slice(12)] ? 1 : 0) - (SCREENS[a.rel.slice(12)] ? 1 : 0) || a.name.localeCompare(b.name)));
    if (p === '/api/values') return reply(res, 200, scan(safe(url.searchParams.get('file'))));
    if (p === '/api/search') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const out = [];
      for (const rel of walk(SRC))
        for (const i of scan(rel))
          if (out.length < 300 && `${screen(rel)} ${i.group} ${i.prop} ${i.label ?? ''} ${i.src}`.toLowerCase().includes(q)) out.push({ ...i, rel, screen: screen(rel) });
      return reply(res, 200, out);
    }
    if (p === '/api/status') return reply(res, 200, status());
    if (req.method === 'POST' && p === '/api/set') {
      const b = await json(req);
      setValue(safe(b.file), b.key, b.value);
      return reply(res, 200, status());
    }
    if (req.method === 'POST' && p === '/api/send') return reply(res, 200, { commit: await send((await json(req)).note) });
    if (req.method === 'POST' && p === '/api/discard') return discard(), reply(res, 200, status());
    reply(res, 404, { error: 'not found' });
  } catch (e) {
    reply(res, 400, { error: String(e.message || e) });
  }
}).listen(PORT, () => console.log(`tweak on :${PORT}, repo ${REPO}, push ${PUSH_URL ? 'on' : 'off'}`));
