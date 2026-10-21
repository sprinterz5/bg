import type { FastifyInstance } from "fastify";

// Messages that share an article carry a small preview of it (the chat shows a card that opens the post).
// Message.sharedArticleId has no relation in the schema, so the articles are loaded here in one query.
const articlePreviewSelect = {
  id: true,
  title: true,
  subtitle: true,
  coverImageUrl: true,
  author: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
} as const;

export async function withSharedArticles<T extends { sharedArticleId: string | null }>(app: FastifyInstance, messages: T[]) {
  const ids = [...new Set(messages.flatMap((m) => (m.sharedArticleId ? [m.sharedArticleId] : [])))];
  const articles = ids.length
    ? await app.prisma.article.findMany({
        where: { id: { in: ids }, status: "PUBLISHED", moderationStatus: "APPROVED", deletedAt: null },
        select: articlePreviewSelect
      })
    : [];
  const byId = new Map(articles.map((a) => [a.id, a]));
  // null when the article is gone (deleted / unpublished): the chat shows "Post unavailable"
  return messages.map((m) => ({ ...m, sharedArticle: m.sharedArticleId ? (byId.get(m.sharedArticleId) ?? null) : null }));
}
