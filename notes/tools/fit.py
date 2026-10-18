#!/usr/bin/env python3
"""Font size from a design text layer's ink box, measured by Chrome with the app's own font files.

Usage: fit.py <family> "<text>" <ink width> [<ink height>] [weights, e.g. 400,500,600]
  family: inter | caveat | serif   (text layers in the export are outlines: the layer name is the text)
Prints per weight: font size matching the ink width, the ink height it would give, and where the
ink top sits below the CSS/RN line-box top for a given lineHeight (=1.2×size, see 'top@lh').
"""
import glob
import json
import os
import subprocess
import sys
import tempfile

FONTS = {
    'inter': ('@expo-google-fonts/inter/{w}*/Inter_{w}*.ttf', 'Inter_{w}'),
    'caveat': ('@expo-google-fonts/caveat/{w}*/Caveat_{w}*.ttf', 'Caveat_{w}'),
    'serif': ('@expo-google-fonts/source-serif-4/{w}*/SourceSerif4_{w}*.ttf', 'SS4_{w}'),
}
NM = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../apps/mobile/node_modules/')


def main():
    fam, text, W = sys.argv[1], sys.argv[2], float(sys.argv[3])
    Hh = float(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] else None
    weights = (sys.argv[5] if len(sys.argv) > 5 else '400,500,600,700').split(',')
    pat, name = FONTS[fam]
    faces, items = [], []
    for w in weights:
        f = sorted(g for g in glob.glob(NM + pat.format(w=w)) if 'Italic' not in g)
        if not f:
            continue
        faces.append("@font-face{font-family:'%s';src:url('file://%s')}" % (name.format(w=w), os.path.realpath(f[0])))
        items.append((w, name.format(w=w)))
    html = """<html><head><style>%s</style></head><body><span style="font-family:%s">x</span><script>
document.fonts.ready.then(async()=>{await Promise.all(%s.map(f=>document.fonts.load('100px '+f)));
const c=document.createElement('canvas').getContext('2d');const out=[];
for(const [w,f] of %s){c.font='100px '+f;const m=c.measureText(%s);
out.push([w,m.actualBoundingBoxLeft+m.actualBoundingBoxRight,m.actualBoundingBoxLeft,m.actualBoundingBoxAscent,m.actualBoundingBoxDescent,m.fontBoundingBoxAscent,m.fontBoundingBoxDescent,m.width]);}
document.body.setAttribute('data-r',JSON.stringify(out));});</script></body></html>""" % (
        ''.join(faces), ','.join("'%s'" % n for _, n in items), json.dumps([n for _, n in items]),
        json.dumps(items), json.dumps(text))
    tmp = tempfile.NamedTemporaryFile('w', suffix='.html', delete=False)
    tmp.write(html); tmp.close()
    ch = sorted(glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')))[-1]
    dom = subprocess.run([ch, '--no-sandbox', '--allow-file-access-from-files', '--virtual-time-budget=3000', '--dump-dom', 'file://' + tmp.name],
                         capture_output=True, text=True).stdout
    os.unlink(tmp.name)
    import html as h, re
    r = json.loads(h.unescape(re.search(r'data-r="([^"]*)"', dom).group(1)))
    for w, iw, bbl, asc, desc, fasc, fdesc, adv in r:
        size = W / iw * 100
        k = size / 100
        ih = (asc + desc) * k
        # CSS line box with lineHeight L: content area (fasc+fdesc) centred, baseline at top + (L-(fasc+fdesc)k)/2 + fasc k
        L = round(size * 1.2, 1)
        top = (L - (fasc + fdesc) * k) / 2 + fasc * k - asc * k
        print('w%s size %.2f  ink h %.1f%s  ink top %.2f below box top at lineHeight %.1f; ink left %.2f from text start; advance %.1f' % (
            w, size, ih, ' (target %.1f)' % Hh if Hh else '', top, L, -bbl * k, adv * k))


if __name__ == '__main__':
    main()
