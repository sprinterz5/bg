import type { FastifyInstance } from "fastify";

type ColdStartAuthor = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

function tagMatchScore(values: string[], interests: string[]) {
  const normalized = new Set(interests.map((interest) => interest.toLowerCase()));
  return values.reduce((score, value) => score + (normalized.has(value.toLowerCase()) ? 10 : 0), 0);
}

export async function needsColdStart(app: FastifyInstance, userId: string) {
  const [events, follows, shelfItems] = await Promise.all([
    app.prisma.feedEvent.count({ where: { userId } }),
    app.prisma.follow.count({ where: { followerId: userId } }),
    app.prisma.shelfItem.count({ where: { userId } })
  ]);

  return events < 5 && follows < 3 && shelfItems < 3;
}

export async function getColdStartFeed(
  app: FastifyInstance,
  userId: string,
  interests: string[],
  limit: number
) {
  const blocked = await app.prisma.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true }
  });
  const hiddenAuthorIds = blocked.map((block) => (block.blockerId === userId ? block.blockedId : block.blockerId));

  const [articles, reviews] = await Promise.all([
    app.prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        moderationStatus: "APPROVED",
        deletedAt: null,
        ...(hiddenAuthorIds.length > 0 ? { authorId: { notIn: hiddenAuthorIds } } : {})
      },
      orderBy: [{ publishedAt: "desc" }],
      take: limit * 3,
      include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
    }),
    app.prisma.review.findMany({
      where: {
        status: "PUBLISHED",
        moderationStatus: "APPROVED",
        deletedAt: null,
        ...(hiddenAuthorIds.length > 0 ? { authorId: { notIn: hiddenAuthorIds } } : {})
      },
      orderBy: [{ publishedAt: "desc" }],
      take: limit * 3,
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        book: true
      }
    })
  ]);

  const mappedArticles = articles.map((article) => ({
    id: `article:${article.id}`,
    targetType: "ARTICLE" as const,
    targetId: article.id,
    authorId: article.authorId,
    title: article.title,
    excerpt: article.excerpt,
    coverImageUrl: article.coverImageUrl,
    tags: article.tags,
    categories: [] as string[],
    author: article.author as ColdStartAuthor,
    publishedAt: article.publishedAt ?? article.createdAt,
    readingTimeMinutes: article.readingTimeMinutes,
    score: tagMatchScore(article.tags, interests)
  }));

  const mappedReviews = reviews.map((review) => ({
    id: `review:${review.id}`,
    targetType: "REVIEW" as const,
    targetId: review.id,
    authorId: review.authorId,
    title: review.title,
    excerpt: review.body.slice(0, 280),
    rating: review.rating,
    tags: review.tags,
    categories: review.book.categories,
    author: review.author as ColdStartAuthor,
    book: review.book,
    publishedAt: review.publishedAt ?? review.createdAt,
    readingTimeMinutes: review.readingTimeMinutes,
    score: tagMatchScore([...review.tags, ...review.book.categories], interests)
  }));

  return [...mappedArticles, ...mappedReviews]
    .sort((a, b) => b.score - a.score || b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, limit);
}
