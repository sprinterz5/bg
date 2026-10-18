#!/usr/bin/env python3
"""Cut an icon (or any fragment) out of a design frame SVG into a standalone SVG.

Usage: extract.py <frame.svg> x y w h <out.svg> [--pad P]
Takes every drawable element whose box lies inside the region (pt), plus the masks / clip paths / gradients /
<use> targets they reference, and writes them with viewBox = region (padded by P, default 0).
"""
import copy
import re
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from svgdiff import path_bbox  # noqa: E402

NS = 'http://www.w3.org/2000/svg'
XL = 'http://www.w3.org/1999/xlink'
ET.register_namespace('', NS)
ET.register_namespace('xlink', XL)
DRAW = {'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'use'}


def tag(el):
    return el.tag.split('}')[-1]


def box(el, ids):
    t = tag(el)
    a = el.attrib
    try:
        if t == 'path':
            b = path_bbox(a['d'])
            if not b:
                return None
            x, y, w, h = map(float, re.findall(r'-?[\d.]+', b))
            return x, y, w, h
        tx = ty = 0.0
        m = re.match(r'translate\(([-\d.]+)[ ,]*([-\d.]*)\)', a.get('transform', ''))
        if m:
            tx, ty = float(m.group(1)), float(m.group(2) or 0)
        if t == 'rect':
            return float(a.get('x', 0)) + tx, float(a.get('y', 0)) + ty, float(a['width']), float(a['height'])
        if t == 'circle':
            r = float(a['r'])
            return float(a['cx']) - r, float(a['cy']) - r, 2 * r, 2 * r
        if t == 'ellipse':
            return float(a['cx']) - float(a['rx']), float(a['cy']) - float(a['ry']), 2 * float(a['rx']), 2 * float(a['ry'])
        if t == 'use':
            ref = (a.get('{%s}href' % XL) or a.get('href') or '').lstrip('#')
            return box(ids[ref], ids) if ref in ids else None
    except (KeyError, ValueError):
        return None
    return None


def main():
    src, x, y, w, h, out = sys.argv[1], *map(float, sys.argv[2:6]), sys.argv[6]
    pad = float(sys.argv[sys.argv.index('--pad') + 1]) if '--pad' in sys.argv else 0.0
    root = ET.parse(src).getroot()
    ids = {el.get('id'): el for el in root.iter() if el.get('id')}
    defs_ids = {el.get('id') for d in root.iter('{%s}defs' % NS) for el in d.iter() if el.get('id')}
    mask_ids = {el.get('id') for el in root.iter() if tag(el) in ('mask', 'clipPath')}
    keep, need = [], set()

    def refs(el):
        for v in el.attrib.values():
            need.update(re.findall(r'url\(#([^)]+)\)', v))
        href = el.get('{%s}href' % XL) or el.get('href')
        if href and href.startswith('#'):
            need.add(href[1:])

    def inside_mask(el, parents):
        return any(tag(p) in ('mask', 'clipPath', 'defs', 'pattern') for p in parents)

    def walk(el, parents):
        if tag(el) in DRAW and not inside_mask(el, parents):
            b = box(el, ids)
            if b and b[0] >= x - 0.6 and b[1] >= y - 0.6 and b[0] + b[2] <= x + w + 0.6 and b[1] + b[3] <= y + h + 0.6:
                e = copy.deepcopy(el)
                # keep group opacity / fill set on direct named parents
                for p in parents[::-1]:
                    if tag(p) == 'g' and p.get('opacity'):
                        e.set('opacity', p.get('opacity'))
                        break
                keep.append(e)
                refs(el)
        for c in el:
            walk(c, parents + [el])

    walk(root, [])
    # resolve references transitively
    done = set()
    defs = []
    while need - done:
        r = (need - done).pop()
        done.add(r)
        if r in ids:
            d = copy.deepcopy(ids[r])
            defs.append(d)
            for el in d.iter():
                refs(el)
    svg = ET.Element('{%s}svg' % NS, {'width': '%g' % (w + 2 * pad), 'height': '%g' % (h + 2 * pad),
                                       'viewBox': '0 0 %g %g' % (w + 2 * pad, h + 2 * pad), 'fill': 'none'})
    if defs:
        de = ET.SubElement(svg, '{%s}defs' % NS)
        for d in defs:
            de.append(d)
    g = ET.SubElement(svg, '{%s}g' % NS, {'transform': 'translate(%g %g)' % (pad - x, pad - y)})
    for e in keep:
        g.append(e)
    ET.ElementTree(svg).write(out, xml_declaration=False)
    print('%s: %d elements, %d defs' % (out, len(keep), len(defs)))


if __name__ == '__main__':
    main()
