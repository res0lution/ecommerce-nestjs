-- DropIndex
DROP INDEX "user_addresses_userId_idx";

-- DropIndex
DROP INDEX "user_settings_userId_idx";

-- CreateIndex
CREATE INDEX "user_addresses_userId_isDefault_createdAt_idx" ON "user_addresses"("userId", "isDefault" DESC, "createdAt");
