#!/usr/bin/env python3
"""Save the embedded images of a frame SVG (data: URIs) as files, named after their layer (data-name).

Usage: images.py <frame.svg> <out dir>
"""
import base64
import os
import re
import sys
import xml.etree.ElementTree as ET

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for el in ET.parse(src).getroot().iter():
    href = el.get('{http://www.w3.org/1999/xlink}href') or el.get('href') or ''
    m = re.match(r'data:image/(\w+);base64,(.*)', href, re.S)
    if not m:
        continue
    name = el.get('data-name') or el.get('id')
    name = re.sub(r'[^\w.-]+', '_', name)
    ext = 'jpg' if m.group(1) == 'jpeg' else m.group(1)
    if not name.lower().endswith('.' + ext):
        name += '.' + ext
    data = base64.b64decode(m.group(2))
    open(os.path.join(out, name), 'wb').write(data)
    print('%s %s %dKB' % (name, el.get('width') + 'x' + el.get('height'), len(data) // 1024))
