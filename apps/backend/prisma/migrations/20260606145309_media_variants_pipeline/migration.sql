-- CreateEnum
CREATE TYPE "MediaVariantKind" AS ENUM ('THUMBNAIL', 'PREVIEW');

-- CreateTable
CREATE TABLE "MediaVariant" (
    "id" UUID NOT NULL,
    "mediaAssetId" UUID NOT NULL,
    "kind" "MediaVariantKind" NOT NULL,
    "provider" "MediaStorageProvider" NOT NULL DEFAULT 'LOCAL',
    "bucket" TEXT,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaVariant_provider_storageKey_idx" ON "MediaVariant"("provider", "storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "MediaVariant_mediaAssetId_kind_key" ON "MediaVariant"("mediaAssetId", "kind");

-- AddForeignKey
ALTER TABLE "MediaVariant" ADD CONSTRAINT "MediaVariant_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
