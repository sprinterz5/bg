-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'ARTICLE', 'REVIEW', 'STORY', 'MESSAGE', 'NOTE');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'HATE', 'SEXUAL_CONTENT', 'VIOLENCE', 'COPYRIGHT', 'AI_SLOP', 'MISINFORMATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReportResolution" AS ENUM ('CONTENT_REMOVED', 'USER_WARNED', 'USER_SUSPENDED', 'NO_VIOLATION', 'DUPLICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedEventType" AS ENUM ('IMPRESSION', 'OPEN', 'READ_PROGRESS', 'DWELL_TIME', 'LIKE', 'SAVE', 'HIDE', 'SHARE');

-- CreateEnum
CREATE TYPE "FeedEventTargetType" AS ENUM ('ARTICLE', 'REVIEW', 'BOOK', 'STORY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('FOLLOW', 'LIKE', 'COMMENT', 'NOTE_REPLY', 'MESSAGE', 'STORY_VIEW', 'MODERATION_APPROVED', 'MODERATION_REJECTED', 'REPORT_RESOLVED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationActorType" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationTargetType" AS ENUM ('USER', 'ARTICLE', 'REVIEW', 'BOOK', 'STORY', 'MESSAGE', 'REPORT', 'CONVERSATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MediaStorageProvider" AS ENUM ('LOCAL', 'R2', 'S3');

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "bucket" TEXT,
ADD COLUMN     "provider" "MediaStorageProvider" NOT NULL DEFAULT 'LOCAL';

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" "ReportResolution",
    "moderatorId" UUID,
    "moderatorNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eventType" "FeedEventType" NOT NULL,
    "targetType" "FeedEventTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "source" TEXT,
    "dwellMs" INTEGER,
    "progress" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "actorType" "NotificationActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorId" UUID,
    "targetType" "NotificationTargetType" NOT NULL,
    "targetId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_moderatorId_idx" ON "Report"("moderatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_targetType_targetId_key" ON "Report"("reporterId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "FeedEvent_userId_createdAt_idx" ON "FeedEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedEvent_targetType_targetId_createdAt_idx" ON "FeedEvent"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedEvent_eventType_createdAt_idx" ON "FeedEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_targetType_targetId_idx" ON "Notification"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "MediaAsset_provider_storageKey_idx" ON "MediaAsset"("provider", "storageKey");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedEvent" ADD CONSTRAINT "FeedEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
