#!/usr/bin/env python3
"""Text lines inside a region of a 2x design render: ink box of each line (bands of rows with ink).

Usage: lines.py <design 2x png> x y w h
"""
import sys
import numpy as np
from PIL import Image

im = np.asarray(Image.open(sys.argv[1]).convert('L'), dtype=np.int16)
x, y, w, h = map(float, sys.argv[2:6])
c = im[int(y * 2):int((y + h) * 2), int(x * 2):int((x + w) * 2)]
bg = np.median(c)
ink = np.abs(c - bg) > 60
rows = ink.any(1)
bands, start = [], None
for i, r in enumerate(list(rows) + [False]):
    if r and start is None:
        start = i
    elif not r and start is not None:
        bands.append((start, i)); start = None
# merge bands closer than 3px (i/j dots, accents)
merged = []
for b in bands:
    if merged and b[0] - merged[-1][1] <= 3:
        merged[-1] = (merged[-1][0], b[1])
    else:
        merged.append(b)
for a, b in merged:
    cols = np.nonzero(ink[a:b].any(0))[0]
    print('line ink %.1f,%.1f %.1fx%.1f' % (x + cols[0] / 2, y + a / 2, (cols[-1] - cols[0] + 1) / 2, (b - a) / 2))
