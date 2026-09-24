// Cuts one frame out of the full section export (assets/icons/_inbox/Section 1.svg, exported with layer ids)
// and writes a light copy (embedded images stripped) to measure in a browser with getBBox().
// Usage (from apps/mobile): ../../.tools/node/node.exe scripts/svg-frame.cjs <frameX> [out.svg]
const fs = require('fs');
const path = require('path');

const frameX = process.argv[2];
const out = process.argv[3] || `_tmp-frame-${frameX}.svg`;
const src = fs.readFileSync(path.join(__dirname, '../assets/icons/_inbox/Section 1.svg'), 'utf8');
const strip = (s) => s.replace(/(<image[^>]*?)(xlink:href|href)="data:[^"]*"/g, '$1');

// Frames are the depth-1 groups inside <g id="Section 1">; each is clipped by a 390x844 rect at the frame origin.
const re = /<g[\s>]|<\/g>/g;
let depth = 0;
let m;
const kids = [];
while ((m = re.exec(src))) {
  if (m[0] === '</g>') {
    depth--;
    if (depth === 1) kids[kids.length - 1].end = m.index + 4;
  } else {
    if (depth === 1) kids.push({ start: m.index });
    depth++;
  }
}
const defsStart = src.indexOf('<defs>');
const defs = strip(src.slice(defsStart, src.indexOf('</defs>') + 7));
const frame = kids.find((k) => {
  const clip = src.slice(k.start, k.start + 200).match(/clip-path="url\(#([^)]+)\)"/);
  if (!clip) return false;
  const rect = defs.match(new RegExp(`<clipPath id="${clip[1]}">\\s*<rect[^>]*x="([\\d.]+)" y="([\\d.]+)"`));
  return rect && rect[1] === frameX;
});
if (!frame) throw new Error(`no frame at x=${frameX}`);
const y = defs.match(new RegExp(`x="${frameX}" y="([\\d.]+)"`))[1];
fs.writeFileSync(
  out,
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" data-x="${frameX}" data-y="${y}" width="390" height="844" viewBox="${frameX} ${y} 390 844" fill="none">` +
    strip(src.slice(frame.start, frame.end)) +
    defs +
    '</svg>',
);
console.log(`${out} (frame origin ${frameX},${y})`);
