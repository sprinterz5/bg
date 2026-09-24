-- AlterTable
ALTER TABLE "User" ADD COLUMN "googleUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleUserId_key" ON "User"("googleUserId");
