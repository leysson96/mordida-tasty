-- Add cash payments without changing the existing Stripe card flow.
CREATE TYPE "OrderPaymentMethod" AS ENUM ('CARD', 'CASH');

ALTER TYPE "PaymentProvider" ADD VALUE 'CASH';

ALTER TABLE "Order"
  ADD COLUMN "paymentMethod" "OrderPaymentMethod" NOT NULL DEFAULT 'CARD',
  ADD COLUMN "cashTenderedCents" INTEGER,
  ADD COLUMN "cashChangeCents" INTEGER;

CREATE INDEX "Order_paymentMethod_idx" ON "Order"("paymentMethod");
