#!/usr/bin/env python3
"""True ink box (pt) of design layers, from the 2x render instead of the path bbox (control points overshoot).

Usage: ink.py <design 2x png> x y w h [x y w h ...]   (rough boxes in pt, e.g. from svgdiff dump; 4pt margin added)
Background = the colour at the box corner; ink = pixels differing from it by > 25%.
"""
import sys
import numpy as np
from PIL import Image

im = np.asarray(Image.open(sys.argv[1]).convert('RGB'), dtype=np.int16)
v = list(map(float, sys.argv[2:]))
for i in range(0, len(v), 4):
    x, y, w, h = v[i:i + 4]
    x0, y0, x1, y1 = int((x - 4) * 2), int((y - 4) * 2), int((x + w + 4) * 2), int((y + h + 4) * 2)
    c = im[y0:y1, x0:x1]
    bg = c[0, 0]
    m = np.abs(c - bg).max(2) > 64
    ys, xs = np.nonzero(m)
    if not len(ys):
        print('no ink'); continue
    print('ink %.1f,%.1f %.1fx%.1f  colour #%02X%02X%02X' % ((x0 + xs.min()) / 2, (y0 + ys.min()) / 2, (xs.max() - xs.min() + 1) / 2,
          (ys.max() - ys.min() + 1) / 2, *c[ys, xs][np.argmax(np.abs(c[ys, xs] - bg).sum(1))]))
