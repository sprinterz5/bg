// Small words stay lowercase unless they open or close the title (or follow a colon).
const SMALL = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by', 'in', 'of', 'off', 'on', 'per',
  'to', 'up', 'via', 'from', 'into', 'onto', 'over', 'with', 'than', 'this', 'that', 'these', 'those', 'vs',
]);

/** "3 nighty habits for the week" → "3 Nighty Habits for the Week". */
export function titleCase(s: string) {
  const words = s.split(/(\s+)/);
  const last = words.length - 1;
  let afterColon = false;
  return words
    .map((w, i) => {
      if (/^\s+$/.test(w)) return w;
      const lower = w.toLowerCase();
      const keep = i !== 0 && i !== last && !afterColon && SMALL.has(lower.replace(/[^a-z]/g, ''));
      afterColon = /[:—–-]$/.test(w);
      if (keep) return lower;
      return w.replace(/\p{L}/u, (c) => c.toUpperCase());
    })
    .join('');
}
