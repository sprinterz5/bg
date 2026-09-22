-- CreateIndex
CREATE INDEX "Article_tags_idx" ON "Article" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "Book_authors_idx" ON "Book" USING GIN ("authors");

-- CreateIndex
CREATE INDEX "Book_categories_idx" ON "Book" USING GIN ("categories");

-- CreateIndex
CREATE INDEX "Review_tags_idx" ON "Review" USING GIN ("tags");
