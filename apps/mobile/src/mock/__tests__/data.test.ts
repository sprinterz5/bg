import { expect, test } from '@jest/globals';
import { ARTICLES, EXPLORE_FEED, FEED, SEARCH_ARTICLES, getProfile } from '../data';

test('every mock post opens an article with the same cover and title', () => {
  for (const post of [...FEED, ...EXPLORE_FEED, ...SEARCH_ARTICLES]) {
    const article = ARTICLES[post.articleId];
    expect(article).toBeDefined();
    expect(article.cover).toBe(post.image);
    expect(article.title).toBe(post.title);
  }
});

test('feed post authors match their article authors', () => {
  for (const post of FEED) expect(ARTICLES[post.articleId].author.username).toBe(post.author.username);
});

test('mock authors get a profile listing their articles', () => {
  const author = FEED[0].author.username;
  const profile = getProfile(author);
  expect(profile.posts.length).toBeGreaterThan(0);
  expect(profile.articles).toBe(profile.posts.length);
  for (const p of profile.posts) expect(ARTICLES[p.articleId!].author.username).toBe(author);
});
