-- A chat message can be a reply to a story.
ALTER TABLE "Message" ADD COLUMN "replyToStoryId" UUID;
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToStoryId_fkey" FOREIGN KEY ("replyToStoryId") REFERENCES "Story"("id") ON DELETE SET NULL ON UPDATE CASCADE;
