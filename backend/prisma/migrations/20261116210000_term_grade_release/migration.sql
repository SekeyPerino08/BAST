ALTER TABLE "Term"
ADD COLUMN "gradesReleasedAt" TIMESTAMP(3),
ADD COLUMN "gradesReleasedById" TEXT;

UPDATE "Term"
SET "gradesReleasedAt" = COALESCE("lockedAt", "updatedAt")
WHERE "gradesLocked" = true;

CREATE INDEX "Term_gradesReleasedById_idx" ON "Term"("gradesReleasedById");

ALTER TABLE "Term"
ADD CONSTRAINT "Term_gradesReleasedById_fkey"
FOREIGN KEY ("gradesReleasedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
