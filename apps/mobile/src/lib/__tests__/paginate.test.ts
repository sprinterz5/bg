import { expect, test } from '@jest/globals';
import { paginateLines } from '../paginate';

test('splits lines by the available height, first page has its own budget', () => {
  const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`);
  const pages = paginateLines(lines, 10, { first: 30, rest: 50 });
  expect(pages.map((p) => p.split('\n').length)).toEqual([3, 5, 2]);
});

test('drops blank lines at the top of later pages and the end of a page', () => {
  const pages = paginateLines(['a', 'b', '', '', 'c'], 10, { first: 30, rest: 30 });
  expect(pages).toEqual(['a\nb', 'c']);
});
