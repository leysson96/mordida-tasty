CREATE TYPE "CommercialConsentChannel" AS ENUM (
  'EMAIL',
  'SMS',
  'WHATSAPP'
);

CREATE TYPE "CommercialConsentSource" AS ENUM (
  'REGISTRATION',
  'ACCOUNT'
);

ALTER TABLE "User"
ADD COLUMN "lastLoginAt" TIMESTAMP(3);

CREATE TABLE "CommercialConsent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" "CommercialConsentChannel" NOT NULL,
  "grantedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "consentVersion" TEXT NOT NULL,
  "source" "CommercialConsentSource" NOT NULL,
  "withdrawalSource" "CommercialConsentSource",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommercialConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommercialConsent_state_check" CHECK (
    ("grantedAt" IS NOT NULL AND "withdrawnAt" IS NULL AND "withdrawalSource" IS NULL)
    OR
    ("withdrawnAt" IS NOT NULL AND "withdrawalSource" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "CommercialConsent_userId_channel_key"
ON "CommercialConsent"("userId", "channel");

CREATE INDEX "CommercialConsent_channel_withdrawnAt_idx"
ON "CommercialConsent"("channel", "withdrawnAt");

CREATE INDEX "CommercialConsent_updatedAt_idx"
ON "CommercialConsent"("updatedAt");

ALTER TABLE "CommercialConsent"
ADD CONSTRAINT "CommercialConsent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
