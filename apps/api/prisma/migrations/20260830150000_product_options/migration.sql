CREATE TABLE "ProductOptionGroup" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "minChoices" INTEGER NOT NULL DEFAULT 0,
    "maxChoices" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductOptionGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductOptionChoice" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductOptionChoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItemOption" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "choiceName" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItemOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductOptionGroup_productId_active_sortOrder_idx" ON "ProductOptionGroup"("productId", "active", "sortOrder");
CREATE INDEX "ProductOptionChoice_groupId_active_sortOrder_idx" ON "ProductOptionChoice"("groupId", "active", "sortOrder");
CREATE INDEX "OrderItemOption_orderItemId_idx" ON "OrderItemOption"("orderItemId");

ALTER TABLE "ProductOptionGroup" ADD CONSTRAINT "ProductOptionGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductOptionChoice" ADD CONSTRAINT "ProductOptionChoice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductOptionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemOption" ADD CONSTRAINT "OrderItemOption_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
