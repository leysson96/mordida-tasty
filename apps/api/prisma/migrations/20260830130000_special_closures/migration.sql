CREATE TABLE "SpecialClosure" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialClosure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SpecialClosure_active_startsAt_endsAt_idx" ON "SpecialClosure"("active", "startsAt", "endsAt");
CREATE INDEX "SpecialClosure_createdById_idx" ON "SpecialClosure"("createdById");

ALTER TABLE "SpecialClosure" ADD CONSTRAINT "SpecialClosure_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
