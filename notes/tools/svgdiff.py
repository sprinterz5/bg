#!/usr/bin/env python3
"""Compare two design exports (folders of Figma SVG frames) element by element.

Usage:
  svgdiff.py snap <folder> <out.json.gz>          normalise every SVG into a small snapshot
  svgdiff.py diff <old.json.gz> <new.json.gz>     per-screen report (markdown) to stdout
  svgdiff.py merge <old.json.gz> <new.json.gz> <out.json.gz>
                                                  for a partial export: new screens replace the old
                                                  ones they match, everything else is kept

A snapshot keeps, for every element: its layer path (ids of ancestors), tag and
attributes. Path data is reduced to a bbox + short hash, embedded images to a
hash + size, export-generated suffixes (clip0_4449_3514) are stripped, numbers
are rounded to 0.1. Screens are paired by content, not by file name (Figma
renumbers -1/-2/... between exports).
"""
import gzip
import hashlib
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

NS = re.compile(r'^\{[^}]*\}')
GEN = re.compile(r'(_\d+_\d+)$')  # clip0_4449_3514 -> clip0
DUP = re.compile(r'_\d+$')  # Vector_2 -> Vector (order kept by index)
GENERIC = re.compile(r'^(Frame|Group|Auto Layout|Container)( \d+)?$')  # recreated frames get new numbers
NUM = re.compile(r'-?\d*\.?\d+(?:e-?\d+)?')
SKIP = {'d', 'id', '{http://www.w3.org/1999/xlink}href', 'href'}


def h(s):
    return hashlib.sha1(s.encode() if isinstance(s, str) else s).hexdigest()[:8]


def _r(x):
    x = float(x)
    t = ('%.4f' % x) if 0 < abs(x) < 1 else ('%.1f' % x)
    return t.rstrip('0').rstrip('.') if '.' in t else t


def rnd(v):
    return NUM.sub(lambda m: _r(m.group()), v)


def path_bbox(d):
    """Rough bbox of an absolute path (control points included)."""
    xs, ys = [], []
    toks = re.findall(r'[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?', d)
    cmd, args, cx, cy = None, [], 0.0, 0.0

    def flush():
        nonlocal cx, cy
        if cmd in 'MLCSQT':
            for i in range(0, len(args) - 1, 2):
                cx, cy = args[i], args[i + 1]
                xs.append(cx); ys.append(cy)
        elif cmd == 'H':
            for a in args:
                cx = a; xs.append(cx); ys.append(cy)
        elif cmd == 'V':
            for a in args:
                cy = a; xs.append(cx); ys.append(cy)
        elif cmd == 'A':
            for i in range(0, len(args) - 6, 7):
                cx, cy = args[i + 5], args[i + 6]
                xs.append(cx); ys.append(cy)
        elif cmd and cmd.islower():
            return False
        return True

    for t in toks:
        if t.isalpha():
            if cmd and not flush():
                return None
            cmd, args = t, []
        else:
            args.append(float(t))
    if cmd and not flush():
        return None
    if not xs:
        return None
    return '%.1f,%.1f %.1fx%.1f' % (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))


def norm_ref(v):
    # url(#pattern4_4449_1) -> url(#pattern): def numbering shifts whenever anything is added
    return re.sub(r'url\(#([^)]*)\)', lambda m: 'url(#%s)' % re.sub(r'\d+$', '', GEN.sub('', m.group(1))), v)


def snap_file(path):
    root = ET.parse(path).getroot()
    out = []
    counts = {}

    def walk(el, chain):
        tag = NS.sub('', el.tag)
        rid = el.get('id') or ''
        name = DUP.sub('', GEN.sub('', rid)) or tag
        name = re.sub(r'^(stroke|clip|mask|pattern|paint|filter|image)\d+', r'\1', name)
        key0 = '/'.join([c for c in chain if not GENERIC.match(c)] + [name])
        n = counts.get(key0, 0)
        counts[key0] = n + 1
        key = key0 + ('#%d' % n if n else '')
        attrs = {}
        for k, v in el.attrib.items():
            k2 = NS.sub('', k)
            if k in SKIP:
                continue
            attrs[k2] = rnd(norm_ref(v))
        if 'd' in el.attrib:
            attrs['bbox'] = path_bbox(el.attrib['d']) or '?'
            attrs['shape'] = h(el.attrib['d'])
        href = el.get('{http://www.w3.org/1999/xlink}href') or el.get('href')
        if href:
            if href.startswith('data:'):
                attrs['img'] = h(href) + ' %dKB' % (len(href) // 1365)
            else:
                attrs['ref'] = re.sub(r'\d+$', '', GEN.sub('', href.lstrip('#')))
        txt = (el.text or '').strip()
        if txt:
            attrs['text'] = txt[:80]
        out.append([key, tag, rid, attrs])
        for c in el:
            walk(c, chain + [name])

    walk(root, [])
    return out


def snap(folder, dst):
    data = {}
    for f in sorted(os.listdir(folder)):
        if f.lower().endswith('.svg') and os.path.getsize(os.path.join(folder, f)) > 0:
            data[f] = snap_file(os.path.join(folder, f))
            print('  %s: %d elements' % (f, len(data[f])), file=sys.stderr)
    with gzip.open(dst, 'wt') as fh:
        json.dump(data, fh, separators=(',', ':'))


def load(p):
    with gzip.open(p, 'rt') as fh:
        return json.load(fh)


def num_close(a, b, tol=0.6):
    na, nb = NUM.findall(a), NUM.findall(b)
    if len(na) != len(nb) or NUM.sub('#', a) != NUM.sub('#', b):
        return False
    return all(abs(float(x) - float(y)) <= tol for x, y in zip(na, nb))


def strip_root(key):
    return key.split('/', 2)[2] if key.count('/') >= 2 else None


def leaf(key):
    return re.sub(r'#\d+$', '', key.rsplit('/', 1)[-1])


def bag(els):
    from collections import Counter
    return Counter((e[1], leaf(e[0])) for e in els)


def pair(old, new):
    bo = {k: bag(v) for k, v in old.items()}
    bn = {k: bag(v) for k, v in new.items()}
    scores = []
    for a in old:
        for b in new:
            inter = sum((bo[a] & bn[b]).values())
            union = sum((bo[a] | bn[b]).values())
            scores.append((inter / max(1, union), a, b))
    scores.sort(reverse=True)
    used_o, used_n, pairs = set(), set(), {}
    for j, a, b in scores:
        if j < 0.5 or a in used_o or b in used_n:
            continue
        used_o.add(a); used_n.add(b); pairs[b] = (a, j)
    return pairs, [a for a in old if a not in used_o]


IGNORE = re.compile(r'^(stroke\d+|Border|Cap|Capacity|Menu Bar|Levels|Time|Cellular Connection|Wifi|Battery|Home Indicator|Keyboard|Keys|Row \d|Key|Space|Return|Shift Key|Delete Key|Keyboard Switch|Background)$')


def label(els):
    """A few distinctive layer names to recognise the screen by."""
    names = []
    for key, tag, rid, _ in els:
        r = DUP.sub('', GEN.sub('', rid))
        if not r or r in names or IGNORE.match(r) or DEFS.match(r) or GENERIC.match(r) or key.count('/') < 2 \
                or re.match(r'^(Vector|Rectangle|Ellipse|Line|Union|Subtract|Mask|clip|paint|filter|pattern|image|Path|Polygon|Star)\b', r):
            continue
        names.append(r[:60])
        if len(names) >= 5:
            break
    return ', '.join(names)


def attr_changes(a, b):
    ch = []
    for at in sorted(set(a) | set(b)):
        va, vb = a.get(at), b.get(at)
        if va == vb or at == 'shape':
            continue
        if va is not None and vb is not None and num_close(va, vb):
            continue
        ch.append('%s: %s → %s' % (at, va if va is not None else '—', vb if vb is not None else '—'))
    if not ch and a.get('shape') != b.get('shape'):
        ch.append('shape redrawn, same box')
    return ch


DEFS = re.compile(r'^(defs|pattern|clip|image|paint|filter|stroke)\d*($|/)')


def center(attrs):
    bb = attrs.get('bbox')
    if bb and bb != '?':
        x, y, w, hh = map(float, re.findall(NUM, bb))
        return x + w / 2, y + hh / 2
    try:
        if 'cx' in attrs:
            return float(attrs['cx']), float(attrs['cy'])
        if 'x' in attrs or 'width' in attrs:
            return float(attrs.get('x', 0)) + float(attrs.get('width', 0)) / 2, \
                float(attrs.get('y', 0)) + float(attrs.get('height', 0)) / 2
    except ValueError:
        pass
    return None


def screen_map(els):
    m, imgs = {}, {}
    for e in els:
        k = strip_root(e[0])
        if not k:
            continue
        if DEFS.match(k) or DEFS.match(leaf(k)):
            if e[1] == 'image' and 'img' in e[3]:
                imgs[e[3]['img'].split()[0]] = '%s %sx%s %s' % (e[3].get('data-name', '?'), e[3].get('width'), e[3].get('height'), e[3]['img'].split()[1])
            continue
        if e[1] == 'g' and GENERIC.match(leaf(k)) and not (set(e[3]) - {'clip-path', 'data-name'}):
            continue  # plain auto-layout wrapper
        m[k] = e
    return m, imgs


def match(om, nm):
    """Pair old/new layers: same name+tag, nearest position, same parent preferred."""
    groups = {}
    for k, e in om.items():
        groups.setdefault((e[1], leaf(k)), ([], []))[0].append(k)
    for k, e in nm.items():
        groups.setdefault((e[1], leaf(k)), ([], []))[1].append(k)
    pairs, added, removed = [], [], []
    for (tag, name), (os_, ns) in groups.items():
        generic = bool(re.match(r'^(Vector|path|rect|circle|g|use|Rectangle|Ellipse|Line|Union|Subtract|Mask|Text|ellipse|line|Polygon|Star)\b', name)) or GENERIC.match(name)
        cand = []
        for o in os_:
            co = center(om[o][3])
            for n in ns:
                cn = center(nm[n][3])
                d = 0.0 if co is None or cn is None else ((co[0] - cn[0]) ** 2 + (co[1] - cn[1]) ** 2) ** 0.5
                par = 0 if o.rsplit('/', 1)[0] == n.rsplit('/', 1)[0] else 1
                same = 0 if o == n else 1
                cand.append((same * 0.5 + par * 5 + d, d, o, n))
        cand.sort()
        uo, un = set(), set()
        for cost, d, o, n in cand:
            if o in uo or n in un or (generic and d > 40):
                continue
            uo.add(o); un.add(n); pairs.append((o, n))
        removed += [o for o in os_ if o not in uo]
        added += [n for n in ns if n not in un]
    order = {k: i for i, k in enumerate(nm)}
    pairs.sort(key=lambda p: order[p[1]])
    added.sort(key=lambda k: order[k])
    return pairs, added, removed


def diff_screen(oe, ne):
    om, oimg = screen_map(oe)
    nm, nimg = screen_map(ne)
    matched, added, removed = match(om, nm)

    raw = []
    for ok, nk in matched:
        ch = attr_changes(om[ok][3], nm[nk][3])
        if ch:
            where = nk if ok.rsplit('/', 1)[0] == nk.rsplit('/', 1)[0] else '%s (was under %s)' % (nk, ok.rsplit('/', 1)[0] if '/' in ok else 'root')
            raw.append((re.sub(r'#\d+', '', where), nm[nk][1], '; '.join(ch)))
    groups = {}
    for where, tag, ch in raw:
        groups.setdefault((tag, ch), []).append(where)
    lines = []
    for (tag, ch), ws in groups.items():
        if len(ws) > 3:
            lines.append('- ~ %d× %s, e.g. `%s`: %s' % (len(ws), tag, ws[0], ch))
        else:
            lines += ['- ~ `%s` (%s): %s' % (w, tag, ch) for w in ws]

    def top_only(ks):
        s = set(ks)
        return [k for k in ks if not any(k.startswith(p + '/') for p in s if p != k)]

    def kids(k, ks):
        return sum(1 for x in ks if x.startswith(k + '/'))

    for k in top_only(added):
        e = nm[k][3]
        n = kids(k, added)
        info = ', '.join('%s=%s' % (x, e[x]) for x in ('bbox', 'x', 'y', 'cx', 'cy', 'r', 'width', 'height', 'rx', 'fill', 'stroke', 'stroke-width', 'opacity', 'text') if x in e)
        lines.append('- + `%s` (%s)%s %s' % (re.sub(r'#\d+', '', k), nm[k][1], ' +%d inside' % n if n else '', info))
    for k in top_only(removed):
        e = om[k][3]
        n = kids(k, removed)
        info = ', '.join('%s=%s' % (x, e[x]) for x in ('bbox', 'x', 'y', 'width', 'height', 'fill', 'stroke') if x in e)
        lines.append('- − `%s` (%s)%s %s' % (re.sub(r'#\d+', '', k), om[k][1], ' (−%d inside)' % n if n else '', info))
    for hsh in nimg:
        if hsh not in oimg:
            lines.append('- + image %s' % nimg[hsh])
    for hsh in oimg:
        if hsh not in nimg:
            lines.append('- − image %s' % oimg[hsh])
    return lines


def diff(oldp, newp):
    old, new = load(oldp), load(newp)
    pairs, gone = pair(old, new)
    print('| new file | old file | match | changes | looks like |')
    print('|---|---|---|---|---|')
    body = []
    for b in new:
        if b not in pairs:
            bn = bag(new[b])
            j, a = max((sum((bag(old[x]) & bn).values()) / max(1, sum((bag(old[x]) | bn).values())), x) for x in old)
            lines = diff_screen(old[a], new[b])
            print('| %s | (closest %s) | new %.2f | %d | %s |' % (b, a, j, len(lines), label(new[b])))
            body.append('\n## %s — NEW SCREEN, compared with closest old %s (%.2f)\n\nLayers: %s\n\n%s\n' % (b, a, j, label(new[b]), '\n'.join(lines)))
            continue
        a, j = pairs[b]
        lines = diff_screen(old[a], new[b])
        print('| %s | %s | %.2f | %d | %s |' % (b, a, j, len(lines), label(new[b])))
        if lines:
            body.append('\n## %s (was %s)\n\nLayers: %s\n\n%s\n' % (b, a, label(new[b]), '\n'.join(lines)))
    for a in gone:
        print('| — | %s | removed | — | %s |' % (a, label(old[a])))
    print(''.join(body))


def merge(oldp, newp, dst):
    old, new = load(oldp), load(newp)
    pairs, _ = pair(old, new)
    out = {k: v for k, v in old.items() if k not in {a for a, _ in pairs.values()}}
    for b, els in new.items():
        name = b if b not in out else 'new ' + b
        out[name] = els
    with gzip.open(dst, 'wt') as fh:
        json.dump(out, fh, separators=(',', ':'))


if __name__ == '__main__':
    if sys.argv[1] == 'snap':
        snap(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == 'merge':
        merge(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        diff(sys.argv[2], sys.argv[3])
