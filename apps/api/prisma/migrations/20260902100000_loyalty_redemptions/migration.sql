CREATE TYPE "LoyaltyRewardType" AS ENUM ('DISCOUNT_PERCENT', 'FREE_PRODUCT');

CREATE TYPE "LoyaltyRedemptionStatus" AS ENUM ('RESERVED', 'APPLIED', 'RELEASED');

CREATE TABLE "LoyaltyRedemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "rewardType" "LoyaltyRewardType" NOT NULL,
    "status" "LoyaltyRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
    "rewardLabel" TEXT NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "goalOrdersSnapshot" INTEGER NOT NULL,
    "completedOrdersSnapshot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "LoyaltyRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoyaltyRedemption_orderId_key" ON "LoyaltyRedemption"("orderId");

CREATE INDEX "LoyaltyRedemption_userId_status_idx" ON "LoyaltyRedemption"("userId", "status");

CREATE INDEX "LoyaltyRedemption_createdAt_idx" ON "LoyaltyRedemption"("createdAt");

ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
