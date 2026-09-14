CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

CREATE TYPE "DiscountScope" AS ENUM ('PRODUCTS', 'CATEGORY', 'ORDER_TOTAL');

CREATE TYPE "DiscountWeekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "type" "DiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "scope" "DiscountScope" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "weekdays" "DiscountWeekday"[] NOT NULL DEFAULT ARRAY[]::"DiscountWeekday"[],
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Discount_value_positive_check" CHECK ("value" > 0),
    CONSTRAINT "Discount_percentage_value_check" CHECK ("type" <> 'PERCENTAGE' OR "value" <= 10000),
    CONSTRAINT "Discount_date_range_check" CHECK ("endsAt" >= "startsAt"),
    CONSTRAINT "Discount_category_scope_check" CHECK (
        ("scope" = 'CATEGORY' AND "categoryId" IS NOT NULL)
        OR ("scope" <> 'CATEGORY' AND "categoryId" IS NULL)
    )
);

CREATE TABLE "DiscountProduct" (
    "discountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountProduct_pkey" PRIMARY KEY ("discountId", "productId")
);

CREATE INDEX "Discount_active_startsAt_endsAt_idx" ON "Discount"("active", "startsAt", "endsAt");

CREATE INDEX "Discount_scope_active_priority_idx" ON "Discount"("scope", "active", "priority");

CREATE INDEX "Discount_categoryId_idx" ON "Discount"("categoryId");

CREATE INDEX "DiscountProduct_productId_idx" ON "DiscountProduct"("productId");

ALTER TABLE "Discount" ADD CONSTRAINT "Discount_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiscountProduct" ADD CONSTRAINT "DiscountProduct_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscountProduct" ADD CONSTRAINT "DiscountProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
