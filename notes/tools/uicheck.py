#!/usr/bin/env python3
"""Find every layer of a design frame on a screenshot of the app and report how far off it is.

Usage:
  uicheck.py <snapshot.json.gz> <frame.svg name> <design.png> <app.png> [--all] [--skip-y A-B ...]

Both PNGs are 2x renders of 390x844 (headless Chrome, see uicheck.sh). For each design layer with a
box (text, icons, shapes; status bar and home indicator skipped) the design pixels are searched for
in the app screenshot within ±40pt. Output: one line per layer that moved (≥1pt), changed (the best
match still differs) or is missing, in design points.
"""
import gzip
import json
import re
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from svgdiff import DEFS, GENERIC, NUM, leaf, strip_root  # noqa: E402

S = 2  # px per pt
R = 40  # search radius, pt


def box(tag, a):
    try:
        if a.get('bbox') and a['bbox'] != '?':
            x, y, w, h = map(float, NUM.findall(a['bbox']))
            return x, y, w, h
        tx = ty = 0.0
        m = re.match(r'translate\(([-\d.]+)[ ,]*([-\d.]*)\)$', a.get('transform', ''))
        if a.get('transform') and not m:
            return None
        if m:
            tx, ty = float(m.group(1)), float(m.group(2) or 0)
        if tag == 'rect':
            return float(a.get('x', 0)) + tx, float(a.get('y', 0)) + ty, float(a['width']), float(a['height'])
        if tag == 'circle':
            r = float(a['r'])
            return float(a['cx']) - r + tx, float(a['cy']) - r + ty, 2 * r, 2 * r
        if tag == 'ellipse':
            rx, ry = float(a['rx']), float(a['ry'])
            return float(a['cx']) - rx + tx, float(a['cy']) - ry + ty, 2 * rx, 2 * ry
    except (KeyError, ValueError):
        return None
    return None


SHIFTS = []  # (y from, y to, dy): --shift-y 440-530:288

SKIP = re.compile(r'(^|/)(Menu Bar|Home Indicator|Keyboard|Status Bar|Notch)(/|$)')


def layers(els, skip_y):
    out = []
    for key, tag, rid, a in els:
        k = strip_root(key)
        if not k or DEFS.match(k) or DEFS.match(leaf(k)) or SKIP.search(k) or tag in ('g', 'mask', 'use', 'clipPath'):
            continue
        b = box(tag, a)
        if not b:
            continue
        x, y, w, h = b
        if w < 2 and h < 2 or (w > 370 and h > 780) or y + h < 47 or y > 844 - 21:
            continue
        if any(lo <= y + h / 2 <= hi for lo, hi in skip_y):
            continue
        sy = next((d for lo, hi, d in SHIFTS if lo <= y + h / 2 <= hi), 0.0)
        name = leaf(k)
        if GENERIC.match(name) or re.match(r'^(Vector|path|rect|circle|Rectangle|Ellipse|Union|Line)\b', name):
            parent = [p for p in k.split('/')[:-1] if not GENERIC.match(p) and p not in ('g',)]
            name = (parent[-1] + ' › ' if parent else '') + name
        out.append((name, tag, x, y, w, h, a, sy))
    return out


def load_png(p):
    from PIL import ImageFilter
    im = Image.open(p).convert('RGB').filter(ImageFilter.GaussianBlur(1.2))  # antialiasing differs between SVG and text
    return np.asarray(im, dtype=np.float32)


def sample(app, ys, xs):
    """Bilinear lookup of float coordinates; None when too many fall outside."""
    H, W = app.shape[:2]
    ok = (ys >= 0) & (ys < H - 1) & (xs >= 0) & (xs < W - 1)
    if ok.mean() < 0.8:
        return None, ok
    y, x = ys[ok], xs[ok]
    y0, x0 = np.floor(y).astype(int), np.floor(x).astype(int)
    fy, fx = (y - y0)[:, None], (x - x0)[:, None]
    v = (app[y0, x0] * (1 - fy) * (1 - fx) + app[y0 + 1, x0] * fy * (1 - fx)
         + app[y0, x0 + 1] * (1 - fy) * fx + app[y0 + 1, x0 + 1] * fy * fx)
    return v, ok


def match(design, app, x, y, w, h, shape=False, sy=0.0):
    """Best offset (pt) and scale of the design patch in the app image; errors at best / in place."""
    pad = 3
    H, W = design.shape[:2]
    x0, y0 = max(0, int((x - pad) * S)), max(0, int((y - pad) * S))
    x1, y1 = min(W, int((x + w + pad) * S + 1)), min(H, int((y + h + pad) * S + 1))
    patch = design[y0:y1, x0:x1]
    if patch.size == 0 or patch.shape[0] < 3 or patch.shape[1] < 3:
        return None
    lum = patch.mean(2)
    g = np.abs(np.gradient(lum)[0]) + np.abs(np.gradient(lum)[1])
    if shape:  # rect / circle: only its outline counts, not whatever is drawn inside
        ring = np.zeros_like(g, dtype=bool)
        b = int(pad * S + 3)
        ring[:b] = ring[-b:] = True
        ring[:, :b] = ring[:, -b:] = True
        g = np.where(ring, g, 0)
    g = g.ravel()
    n = g.size
    k = min(3000, n)
    idx = np.argpartition(-g, k - 1)[:k] if k < n else np.arange(n)
    ys, xs = np.unravel_index(idx, patch.shape[:2])
    ref = patch[ys, xs]
    ys = (ys + y0).astype(np.float32)
    xs = (xs + x0).astype(np.float32)
    cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
    ys = ys + sy * S  # where this layer is expected in the app (e.g. a footer that sits on the keyboard in the frame)
    cy += sy * S
    contrast = max(12.0, float(ref.std()))

    def err(dx, dy, s=1.0):
        v, ok = sample(app, cy + (ys - cy) * s + dy, cx + (xs - cx) * s + dx)
        if v is None:
            return 1e9
        return float(np.abs(v - ref[ok]).mean()) / contrast

    e0 = err(0, 0)
    if e0 < 0.08:
        return 0.0, 0.0, 1.0, e0, e0
    # coarse: every 2pt on a subsample, then refine the best few at 0.5pt, then try other sizes
    sub = np.arange(len(ys))[:: max(1, len(ys) // 500)]
    ys_s, xs_s, ref_s = ys[sub], xs[sub], ref[sub]

    def err_s(dx, dy):
        v, ok = sample(app, ys_s + dy, xs_s + dx)
        return 1e9 if v is None else float(np.abs(v - ref_s[ok]).mean()) / contrast

    step = 2 * S
    cands = sorted((err_s(dx, dy), dx, dy) for dy in range(-R * S, R * S + 1, step) for dx in range(-R * S, R * S + 1, step))
    best = (e0, 0, 0, 1.0)
    for _, bx, by in cands[:4]:
        for dy in range(by - step, by + step + 1):
            for dx in range(bx - step, bx + step + 1):
                ee = err(dx, dy)
                if ee < best[0]:
                    best = (ee, dx, dy, 1.0)
    if best[0] > 0.12 and max(w, h) > 12:
        _, bx, by, _ = best
        for s_ in np.arange(0.90, 1.105, 0.01):
            for dy in range(by - 2, by + 3):
                for dx in range(bx - 2, bx + 3):
                    ee = err(dx, dy, float(s_))
                    if ee < best[0] - 0.01:
                        best = (ee, dx, dy, float(s_))
    eb, dx, dy, sc = best
    return dx / S, dy / S, sc, eb, e0


def norm_text(t):
    return re.sub(r'\s+', ' ', t.replace('\u00a0', ' ')).strip().lower()


def app_font(t):
    fam = t['family']
    m = re.search(r'_(\d00)', fam)
    wt = m.group(1) if m else str(t['weight'])
    kind = 'caveat' if 'Caveat' in fam else 'serif' if 'Serif' in fam else 'inter'
    ls = t['spacing']
    ls = 0.0 if ls in ('normal', '0px') else float(ls.replace('px', ''))
    return kind, wt, t['size'], ls


def font_report(design_png, texts, lays):
    """Design font (by pixel matching) next to the app's font for every text layer found in the app."""
    from textmatch import match_many
    todo = []
    for name, tag, x, y, w, h, a, sy in lays:
        if tag != 'path' or not re.search(r'[A-Za-z0-9]', name) or ':' in name:
            continue
        nt = norm_text(name.split(' › ')[-1])
        cands = [t for t in texts if norm_text(t['text']) == nt] or [t for t in texts if nt and nt in norm_text(t['text'])]
        if not cands:
            continue
        t = min(cands, key=lambda t: abs(t['y'] - (y + sy)) + abs(t['x'] - x))
        lh = float(t['lineHeight'].replace('px', '')) if t['lineHeight'].endswith('px') else t['size'] * 1.2
        multi = t['h'] > lh * 1.6
        todo.append((name, x, y, w, h, t, multi))
    single = [d for d in todo if not d[6]]
    res = match_many(design_png, [(app_font(d[5])[0], d[0].split(' › ')[-1], d[1], d[2], d[3], d[4]) for d in single]) if single else []
    rows = []
    for (name, x, y, w, h, t, multi), r in zip(single, res):
        kind, wt, size, ls = app_font(t)
        if not r:
            continue
        e, dwt, dls, dsize, _ = r[0]
        bad = dwt != wt or abs(dsize * (1 if True else 1) - size) / size > 0.02 or abs(dls * dsize - ls) > 0.15
        alt = ', '.join('%s/%.1f/%+.2f' % (a[1], a[3], a[2]) for a in r[1:3])
        rows.append('%s %-40s design %s %5.2f ls%+.2fem | app %s %5.2f ls%+.2fpx lh %s  (next: %s)' % (
            'FONT≠' if bad else 'font ', name[:40], dwt, dsize, dls, wt, size, ls, t['lineHeight'], alt))
    for name, x, y, w, h, t, multi in todo:
        if multi:
            kind, wt, size, ls = app_font(t)
            rows.append('font? %-40s multi-line; app %s %s %.2f lh %s' % (name[:40], kind, wt, size, t['lineHeight']))
    return rows


def main():
    args = sys.argv[1:]
    show_all = '--all' in args
    texts = None
    if '--texts' in args:
        texts = json.load(open(args[args.index('--texts') + 1]))
    skip_y = []
    if '--skip-y' in args:
        i = args.index('--skip-y')
        for spec in args[i + 1:]:
            if spec.startswith('--'):
                break
            lo, hi = spec.split('-')
            skip_y.append((float(lo), float(hi)))
    if '--shift-y' in args:
        for spec in args[args.index('--shift-y') + 1:]:
            if spec.startswith('--'):
                break
            rng, d = spec.split(':')
            lo, hi = rng.split('-')
            SHIFTS.append((float(lo), float(hi), float(d)))
    snap, frame, dpng, apng = args[:4]
    with gzip.open(snap, 'rt') as fh:
        els = json.load(fh)[frame]
    design, app = load_png(dpng), load_png(apng)
    rows = []
    for name, tag, x, y, w, h, a, sy in layers(els, skip_y):
        r = match(design, app, x, y, w, h, tag in ('rect', 'circle', 'ellipse'), sy)
        if not r:
            continue
        dx, dy, sc, eb, e0 = r
        moved = abs(dx) >= 1 or abs(dy) >= 1
        sized = abs(sc - 1) >= 0.02
        if eb > 1.2:
            verdict = 'MISSING/DIFFERENT'
        elif eb > 0.6:
            verdict = 'differs'
        elif moved or sized:
            verdict = 'moved' if not sized else 'resized'
        else:
            verdict = 'ok'
        if verdict != 'ok' or show_all:
            rows.append('%-17s %-44s at %6.1f,%6.1f %5.1fx%-5.1f d=(%+5.1f,%+5.1f) size×%.2f err %.2f (in place %.2f)' % (
                verdict, name[:44], x, y, w, h, dx, dy, sc, eb, e0))
    print('\n'.join(rows) if rows else 'all layers match (±1pt)')
    if texts is not None:
        print('\n'.join(font_report(dpng, texts, layers(els, skip_y))))


if __name__ == '__main__':
    main()
