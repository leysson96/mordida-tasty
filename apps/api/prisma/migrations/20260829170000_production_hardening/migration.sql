-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'KITCHEN';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "trackingToken" TEXT;

-- Backfill existing local/development orders with a non-guessable UUID-derived token.
UPDATE "Order"
SET "trackingToken" = 'legacy_' || replace("id", '-', '')
WHERE "trackingToken" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "trackingToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_trackingToken_key" ON "Order"("trackingToken");
