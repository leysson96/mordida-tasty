CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "postalCodes" JSONB NOT NULL,
    "deliveryFeeCents" INTEGER NOT NULL,
    "minimumOrderCents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeliveryZone_active_sortOrder_idx" ON "DeliveryZone"("active", "sortOrder");
