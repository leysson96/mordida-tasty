CREATE TYPE "DataDeletionRequestStatus" AS ENUM (
  'VERIFICATION_REQUIRED',
  'VERIFIED',
  'PROCESSING',
  'COMPLETED',
  'REJECTED'
);

ALTER TABLE "DataDeletionRequest"
ADD COLUMN "status" "DataDeletionRequestStatus" NOT NULL DEFAULT 'VERIFICATION_REQUIRED',
ADD COLUMN "userId" TEXT,
ADD COLUMN "identityVerifiedAt" TIMESTAMP(3),
ADD COLUMN "identityVerificationNote" TEXT,
ADD COLUMN "resolutionNote" TEXT,
ADD COLUMN "resolvedById" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "DataDeletionRequest"
ALTER COLUMN "updatedAt" DROP DEFAULT;

UPDATE "DataDeletionRequest"
SET "status" = 'COMPLETED'
WHERE "resolved" = true;

CREATE INDEX "DataDeletionRequest_status_idx" ON "DataDeletionRequest"("status");
CREATE INDEX "DataDeletionRequest_userId_idx" ON "DataDeletionRequest"("userId");
CREATE INDEX "DataDeletionRequest_resolvedById_idx" ON "DataDeletionRequest"("resolvedById");

ALTER TABLE "DataDeletionRequest"
ADD CONSTRAINT "DataDeletionRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DataDeletionRequest"
ADD CONSTRAINT "DataDeletionRequest_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
