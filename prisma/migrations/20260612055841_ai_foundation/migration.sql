-- CreateEnum
CREATE TYPE "AiEmbeddingTargetType" AS ENUM ('ARTICLE', 'REVIEW', 'BOOK');

-- CreateEnum
CREATE TYPE "AiEmbeddingStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "AiEmbedding" (
    "id" UUID NOT NULL,
    "targetType" "AiEmbeddingTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "inputHash" TEXT NOT NULL,
    "vector" JSONB,
    "textPreview" TEXT,
    "status" "AiEmbeddingStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "embeddedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiEmbedding_targetType_targetId_idx" ON "AiEmbedding"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AiEmbedding_model_status_updatedAt_idx" ON "AiEmbedding"("model", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiEmbedding_targetType_targetId_model_key" ON "AiEmbedding"("targetType", "targetId", "model");
