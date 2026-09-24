// Cuts layers out of a section export (exported with layer ids) into standalone SVG icons.
// Usage (from apps/mobile): node scripts/svg-extract.cjs "<section.svg>" <spec.json>
// spec: [{ "out": "assets/icons/x.svg", "ids": ["Vector_1", ...], "box": [x, y, w, h] }]
// `box` is the absolute viewBox (element bounds + half the stroke), measured with getBBox().
const fs = require('fs');

const [src, specFile] = process.argv.slice(2);
const s = fs.readFileSync(src, 'utf8');
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));

function element(id) {
  const i = s.indexOf(`id="${id}"`);
  if (i < 0) throw new Error(`no layer ${id}`);
  const start = s.lastIndexOf('<', i);
  const tag = s.slice(start + 1, s.indexOf(' ', start));
  if (tag !== 'g') return s.slice(start, s.indexOf('>', i) + 1);
  const re = /<g[\s>]|<\/g>/g;
  re.lastIndex = start;
  let d = 0, m;
  while ((m = re.exec(s))) {
    d += m[0] === '</g>' ? -1 : 1;
    if (d === 0) return s.slice(start, m.index + 4);
  }
}

for (const { out, ids, box } of spec) {
  const body = ids.map(element).join('').replace(/ id="[^"]*"/g, '').replace(/ clip-path="[^"]*"/g, '');
  const [, , w, h] = box;
  fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box.join(' ')}" fill="none">${body}</svg>\n`);
  console.log(out, `${w}x${h}`);
}
