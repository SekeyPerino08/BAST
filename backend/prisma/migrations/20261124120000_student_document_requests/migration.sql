CREATE TYPE "DocumentRequestType" AS ENUM (
    'CERTIFICATE_OF_ENROLLMENT',
    'CERTIFICATE_OF_GOOD_MORAL_CHARACTER',
    'TRANSCRIPT_OF_RECORDS',
    'REPORT_CARD',
    'CERTIFICATE_OF_COMPLETION',
    'OTHER'
);

CREATE TYPE "DocumentRequestStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'APPROVED',
    'REJECTED',
    'READY_FOR_PICKUP',
    'COMPLETED',
    'CANCELLED'
);

CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "documentType" "DocumentRequestType" NOT NULL,
    "reason" TEXT,
    "details" TEXT,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "adminRemarks" TEXT,
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentRequest_studentId_requestedAt_idx" ON "DocumentRequest"("studentId", "requestedAt");
CREATE INDEX "DocumentRequest_status_idx" ON "DocumentRequest"("status");

ALTER TABLE "DocumentRequest"
    ADD CONSTRAINT "DocumentRequest_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
