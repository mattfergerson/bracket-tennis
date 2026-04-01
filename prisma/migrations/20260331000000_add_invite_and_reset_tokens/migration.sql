-- AlterTable
ALTER TABLE "AccessRequest" ADD COLUMN "inviteExpiresAt" TIMESTAMP(3),
ADD COLUMN "inviteToken" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "resetToken" TEXT,
ADD COLUMN "resetTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_inviteToken_key" ON "AccessRequest"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");
