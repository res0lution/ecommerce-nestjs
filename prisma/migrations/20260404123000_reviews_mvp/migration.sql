-- Reviews MVP schema changes
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "products"
ADD COLUMN "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "reviewsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rating1" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rating2" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rating3" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rating4" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rating5" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "reviews"
ADD COLUMN "title" TEXT,
ADD COLUMN "content" TEXT,
ADD COLUMN "pros" TEXT,
ADD COLUMN "cons" TEXT,
ADD COLUMN "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "status" "ReviewStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "reviews"
SET
  "content" = "comment",
  "updatedAt" = COALESCE("updatedAt", "createdAt")
WHERE "content" IS NULL;

ALTER TABLE "reviews"
ALTER COLUMN "content" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "reviews"
DROP COLUMN "comment";

DROP INDEX IF EXISTS "reviews_productId_idx";
CREATE UNIQUE INDEX "reviews_productId_userId_key" ON "reviews"("productId", "userId");
CREATE INDEX "reviews_productId_status_createdAt_idx" ON "reviews"("productId", "status", "createdAt" DESC);
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");
