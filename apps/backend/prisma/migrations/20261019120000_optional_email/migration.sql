-- Signup is username + password: an account may have no email.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
