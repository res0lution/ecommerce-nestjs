-- Align review indexes with list sorting patterns.
DROP INDEX IF EXISTS "reviews_rating_idx";
CREATE INDEX "reviews_productId_status_rating_createdAt_idx"
ON "reviews"("productId", "status", "rating" DESC, "createdAt" DESC);
