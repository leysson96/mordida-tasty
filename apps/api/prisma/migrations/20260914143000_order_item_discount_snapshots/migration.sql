ALTER TABLE "OrderItem"
ADD COLUMN "originalUnitPriceCents" INTEGER,
ADD COLUMN "discountedUnitPriceCents" INTEGER,
ADD COLUMN "originalLineTotalCents" INTEGER,
ADD COLUMN "promotionDiscountId" TEXT,
ADD COLUMN "promotionDiscountName" TEXT,
ADD COLUMN "promotionDiscountType" "DiscountType",
ADD COLUMN "promotionDiscountValue" INTEGER,
ADD COLUMN "promotionDiscountPriority" INTEGER,
ADD COLUMN "promotionDiscountUnitCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "promotionDiscountCents" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "OrderItem_promotionDiscountId_idx" ON "OrderItem"("promotionDiscountId");
