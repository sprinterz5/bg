-- Search foundation for Bookgram.
-- Keeps API contracts stable while enabling faster fuzzy search and future full-text ranking.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "User_search_trgm_idx"
  ON "User"
  USING GIN (
    lower(
      coalesce("username", '') || ' ' ||
      coalesce("displayName", '') || ' ' ||
      coalesce("bio", '')
    ) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS "Book_search_trgm_idx"
  ON "Book"
  USING GIN (
    lower(
      coalesce("title", '') || ' ' ||
      coalesce("subtitle", '') || ' ' ||
      coalesce("isbn10", '') || ' ' ||
      coalesce("isbn13", '') || ' ' ||
      coalesce("publisher", '')
    ) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS "Book_authors_gin_idx"
  ON "Book"
  USING GIN ("authors");

CREATE INDEX IF NOT EXISTS "Book_categories_gin_idx"
  ON "Book"
  USING GIN ("categories");

CREATE INDEX IF NOT EXISTS "Article_search_trgm_idx"
  ON "Article"
  USING GIN (
    lower(
      coalesce("title", '') || ' ' ||
      coalesce("subtitle", '') || ' ' ||
      coalesce("excerpt", '') || ' ' ||
      coalesce("body", '')
    ) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS "Article_tags_gin_idx"
  ON "Article"
  USING GIN ("tags");

CREATE INDEX IF NOT EXISTS "Review_search_trgm_idx"
  ON "Review"
  USING GIN (
    lower(
      coalesce("title", '') || ' ' ||
      coalesce("body", '')
    ) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS "Review_tags_gin_idx"
  ON "Review"
  USING GIN ("tags");
