-- Track whether a customer can use cash payments and why the state changed.

CREATE TYPE "CashTrustStatus" AS ENUM ('PENDING_ACTIVATION', 'ENABLED', 'BLOCKED_INCIDENT');

CREATE TYPE "CashTrustEventType" AS ENUM ('ORDER_COMPLETED', 'CASH_ENABLED', 'CASH_BLOCKED');

CREATE TYPE "CashTrustIncidentReason" AS ENUM ('NO_PICKUP', 'NO_SHOW_DELIVERY');

CREATE TABLE "CustomerCashTrust" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CashTrustStatus" NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "cashEnabled" BOOLEAN NOT NULL DEFAULT false,
    "successfulOrdersCount" INTEGER NOT NULL DEFAULT 0,
    "requiredSuccessfulOrders" INTEGER NOT NULL DEFAULT 2,
    "lastIncidentReason" "CashTrustIncidentReason",
    "lastIncidentAt" TIMESTAMP(3),
    "unlockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerCashTrust_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashTrustEvent" (
    "id" TEXT NOT NULL,
    "trustId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "CashTrustEventType" NOT NULL,
    "incidentReason" "CashTrustIncidentReason",
    "successfulOrdersBefore" INTEGER NOT NULL,
    "successfulOrdersAfter" INTEGER NOT NULL,
    "requiredSuccessfulOrders" INTEGER NOT NULL,
    "cashEnabledAfter" BOOLEAN NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashTrustEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerCashTrust_userId_key" ON "CustomerCashTrust"("userId");
CREATE INDEX "CustomerCashTrust_status_idx" ON "CustomerCashTrust"("status");
CREATE INDEX "CustomerCashTrust_cashEnabled_idx" ON "CustomerCashTrust"("cashEnabled");
CREATE INDEX "CashTrustEvent_trustId_idx" ON "CashTrustEvent"("trustId");
CREATE INDEX "CashTrustEvent_userId_idx" ON "CashTrustEvent"("userId");
CREATE INDEX "CashTrustEvent_orderId_idx" ON "CashTrustEvent"("orderId");
CREATE INDEX "CashTrustEvent_type_createdAt_idx" ON "CashTrustEvent"("type", "createdAt");

ALTER TABLE "CustomerCashTrust"
    ADD CONSTRAINT "CustomerCashTrust_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CashTrustEvent"
    ADD CONSTRAINT "CashTrustEvent_trustId_fkey"
    FOREIGN KEY ("trustId") REFERENCES "CustomerCashTrust"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CashTrustEvent"
    ADD CONSTRAINT "CashTrustEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
