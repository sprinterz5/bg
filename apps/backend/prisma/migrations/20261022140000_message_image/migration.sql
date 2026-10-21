-- Photos in chats.
ALTER TYPE "MessageType" ADD VALUE 'IMAGE';
ALTER TABLE "Message" ADD COLUMN "mediaUrl" TEXT;
