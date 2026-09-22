export type PageBudget = { first: number; rest: number };

/**
 * Splits measured text lines into pages by available line count.
 * Lines keep their measured breaks, so each page re-renders them joined by "\n".
 */
export function paginateLines(lines: string[], lineHeight: number, budget: PageBudget): string[] {
  const clean = lines.map((l) => l.replace(/\n+$/, ''));
  const pages: string[] = [];
  let i = 0;

  while (i < clean.length) {
    const capacity = Math.max(1, Math.floor((pages.length === 0 ? budget.first : budget.rest) / lineHeight));
    while (pages.length > 0 && i < clean.length && clean[i].trim() === '') i++;
    if (i >= clean.length) break;

    const chunk = clean.slice(i, i + capacity);
    i += chunk.length;
    while (chunk.length && chunk[chunk.length - 1].trim() === '') chunk.pop();
    pages.push(chunk.join('\n'));
  }

  return pages;
}
