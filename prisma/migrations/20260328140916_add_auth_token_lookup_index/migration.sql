-- CreateIndex
CREATE INDEX "auth_tokens_type_tokenHash_expiresAt_idx" ON "auth_tokens"("type", "tokenHash", "expiresAt");
