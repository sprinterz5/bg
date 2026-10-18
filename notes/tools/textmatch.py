#!/usr/bin/env python3
"""Pick font weight / letter spacing / size for design text layers by rendering candidates and comparing pixels.

Usage: textmatch.py <design 2x png> <family> "<text>" x y w h [weights] [spacings in em]
  family: inter | caveat | serif;  x y w h: the layer's ink box in pt (svgdiff dump)
As a module: match_many(png, [(family, text, x, y, w, h), ...]) -> best candidates per layer, one Chrome run.
Every candidate is sized so its ink width equals w, drawn by Chrome at 2x, aligned on the ink box and
compared with the design pixels (lower err = closer). Single-line text only.
"""
import glob
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fit import FONTS, NM  # noqa: E402

WEIGHTS = {'inter': ['300', '400', '500', '600', '700', '800'], 'caveat': ['400', '500', '600', '700'], 'serif': ['400', '500', '600', '700']}
SPACINGS = [-0.03, -0.02, -0.01, 0, 0.01, 0.02]
M = 6  # margin around the ink box, pt
GRID_W = 1600


def font_file(fam, wt):
    pat = FONTS[fam][0]
    f = sorted(g for g in glob.glob(NM + pat.format(w=wt)) if 'Italic' not in g)
    return os.path.realpath(f[0]) if f else None


def match_many(png, layers, weights=None, spacings=None):
    faces, cells, groups = {}, [], []
    for li, (fam, text, x, y, w, h) in enumerate(layers):
        ws = weights or WEIGHTS[fam]
        group = []
        for wt in ws:
            ff = font_file(fam, wt)
            if not ff:
                continue
            fn = '%s_%s' % (fam, wt)
            faces[fn] = "@font-face{font-family:'%s';src:url('file://%s')}" % (fn, ff)
            for ls in spacings or SPACINGS:
                group.append(len(cells))
                cells.append({'li': li, 'f': fn, 'wt': wt, 'ls': ls, 'T': text, 'W': w, 'H': h,
                              'CW': int(w + 2 * M + 1), 'CH': int(h + 2 * M + 1)})
        groups.append(group)
    # shelf-pack the cells
    cx = cy = row_h = 0
    for c in cells:
        if cx + c['CW'] > GRID_W:
            cx, cy, row_h = 0, cy + row_h, 0
        c['X'], c['Y'] = cx, cy
        cx += c['CW']
        row_h = max(row_h, c['CH'])
    total_h = cy + row_h
    html = """<html><head><style>%s body{margin:0;background:#fff} canvas{position:absolute}</style></head><body><script>
const C=%s;
document.fonts.ready.then(async()=>{await Promise.all([...new Set(C.map(c=>c.f))].map(f=>document.fonts.load('100px '+f)));
const res=[];
for(const c of C){const cv=document.createElement('canvas');cv.width=c.CW*2;cv.height=c.CH*2;cv.style.width=c.CW+'px';cv.style.height=c.CH+'px';
cv.style.left=c.X+'px';cv.style.top=c.Y+'px';document.body.appendChild(cv);
const g=cv.getContext('2d');
const meas=s=>{g.font=s+'px '+c.f;g.letterSpacing=(c.ls*s)+'px';return g.measureText(c.T);};
let s=100,m=meas(s);for(let k=0;k<4;k++){const iw=m.actualBoundingBoxLeft+m.actualBoundingBoxRight-c.ls*s;s=s*c.W/iw;m=meas(s);}
g.scale(2,2);g.font=s+'px '+c.f;g.letterSpacing=(c.ls*s)+'px';g.fillStyle='#000';
g.fillText(c.T,%d+m.actualBoundingBoxLeft,%d+m.actualBoundingBoxAscent);
res.push([s,m.actualBoundingBoxAscent+m.actualBoundingBoxDescent,m.actualBoundingBoxAscent]);}
document.body.setAttribute('data-r',JSON.stringify(res));});</script></body></html>""" % (''.join(faces.values()), json.dumps(cells), M, M)
    tmp = tempfile.mkdtemp()
    hp, sp = os.path.join(tmp, 'c.html'), os.path.join(tmp, 's.png')
    open(hp, 'w').write(html)
    ch = sorted(glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')))[-1]
    common = [ch, '--no-sandbox', '--allow-file-access-from-files', '--virtual-time-budget=5000', '--hide-scrollbars', '--force-device-scale-factor=2']
    dom = subprocess.run(common + ['--dump-dom', 'file://' + hp], capture_output=True, text=True).stdout
    subprocess.run(common + ['--window-size=%d,%d' % (GRID_W, max(1, total_h)), '--screenshot=' + sp, 'file://' + hp], capture_output=True)
    import html as hh, re
    meta = json.loads(hh.unescape(re.search(r'data-r="([^"]*)"', dom).group(1)))
    shot = np.asarray(Image.open(sp).convert('L'), dtype=np.float32)
    des = np.asarray(Image.open(png).convert('L'), dtype=np.float32)
    results = []
    for li, (fam, text, x, y, w, h) in enumerate(layers):
        g0 = cells[groups[li][0]] if groups[li] else None
        if not g0:
            results.append([]); continue
        CW, CH = g0['CW'], g0['CH']
        d = des[int(round((y - M) * 2)):int(round((y - M) * 2)) + CH * 2, int(round((x - M) * 2)):int(round((x - M) * 2)) + CW * 2]
        bg = np.median(np.concatenate([d[0], d[-1], d[:, 0], d[:, -1]]))
        ink = np.abs(d - bg)
        d = 255 - ink / max(1, ink.max()) * 255
        out = []
        for ci in groups[li]:
            c = cells[ci]
            sc = shot[c['Y'] * 2:c['Y'] * 2 + CH * 2, c['X'] * 2:c['X'] * 2 + CW * 2]
            hh_, ww = min(sc.shape[0], d.shape[0]), min(sc.shape[1], d.shape[1])
            best = min(float(np.abs(np.roll(np.roll(sc, dy, 0), dx, 1)[:hh_, :ww] - d[:hh_, :ww]).mean())
                       for dy in (-1, 0, 1) for dx in (-1, 0, 1))
            # stroke weight shows best in the amount of ink
            cov = float((255 - sc[:hh_, :ww]).sum()) / max(1.0, float((255 - d[:hh_, :ww]).sum()))
            best += 25 * abs(np.log(max(cov, 1e-3)))
            out.append((best, c['wt'], c['ls'], meta[ci][0], meta[ci][1]))
        out.sort()
        results.append(out)
    return results


def main():
    png, fam, text = sys.argv[1], sys.argv[2], sys.argv[3]
    x, y, w, h = map(float, sys.argv[4:8])
    weights = sys.argv[8].split(',') if len(sys.argv) > 8 else None
    spacings = [float(v) for v in sys.argv[9].split(',')] if len(sys.argv) > 9 else None
    for e, wt, ls, s, ih in match_many(png, [(fam, text, x, y, w, h)], weights, spacings)[0][:6]:
        print('err %5.2f  weight %s  letterSpacing %+.2fem (%+.2f)  size %.2f  ink h %.1f (target %.1f)' % (e, wt, ls, ls * s, s, ih, h))


if __name__ == '__main__':
    main()
