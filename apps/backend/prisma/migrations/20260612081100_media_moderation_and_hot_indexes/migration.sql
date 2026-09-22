-- CreateEnum
CREATE TYPE "MediaModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'FLAGGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MediaModerationProvider" AS ENUM ('DISABLED', 'LOCAL_STUB', 'OPENAI', 'GOOGLE_VISION', 'AWS_REKOGNITION', 'HIVE');

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderationProvider" "MediaModerationProvider" NOT NULL DEFAULT 'DISABLED',
ADD COLUMN     "moderationReason" TEXT,
ADD COLUMN     "moderationScore" DOUBLE PRECISION,
ADD COLUMN     "moderationStatus" "MediaModerationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "MediaModerationEvent" (
    "id" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "provider" "MediaModerationProvider" NOT NULL,
    "status" "MediaModerationStatus" NOT NULL,
    "score" DOUBLE PRECISION,
    "reason" TEXT,
    "rawJson" JSONB,
    "moderatorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaModerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaModerationEvent_mediaId_createdAt_idx" ON "MediaModerationEvent"("mediaId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaModerationEvent_status_createdAt_idx" ON "MediaModerationEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MediaModerationEvent_provider_createdAt_idx" ON "MediaModerationEvent"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "Article_status_moderationStatus_deletedAt_publishedAt_idx" ON "Article"("status", "moderationStatus", "deletedAt", "publishedAt");

-- CreateIndex
CREATE INDEX "FeedEvent_userId_eventType_createdAt_idx" ON "FeedEvent"("userId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_moderationStatus_createdAt_idx" ON "MediaAsset"("moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Review_status_moderationStatus_deletedAt_publishedAt_idx" ON "Review"("status", "moderationStatus", "deletedAt", "publishedAt");

-- AddForeignKey
ALTER TABLE "MediaModerationEvent" ADD CONSTRAINT "MediaModerationEvent_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaModerationEvent" ADD CONSTRAINT "MediaModerationEvent_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
