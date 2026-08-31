-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "removedAt" TIMESTAMP(3),
ADD COLUMN "removedReason" TEXT,
ADD COLUMN "removedById" TEXT,
ADD COLUMN "refundedCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "stripeRefundId" TEXT;

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "paymentId" TEXT,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "stripeRefundId" TEXT,
    "stripePaymentIntentId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_stripeRefundId_key" ON "OrderItem"("stripeRefundId");

-- CreateIndex
CREATE INDEX "OrderItem_removedAt_idx" ON "OrderItem"("removedAt");

-- CreateIndex
CREATE INDEX "OrderItem_removedById_idx" ON "OrderItem"("removedById");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_stripeRefundId_key" ON "PaymentRefund"("stripeRefundId");

-- CreateIndex
CREATE INDEX "PaymentRefund_orderId_idx" ON "PaymentRefund"("orderId");

-- CreateIndex
CREATE INDEX "PaymentRefund_orderItemId_idx" ON "PaymentRefund"("orderItemId");

-- CreateIndex
CREATE INDEX "PaymentRefund_paymentId_idx" ON "PaymentRefund"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentRefund_stripePaymentIntentId_idx" ON "PaymentRefund"("stripePaymentIntentId");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
