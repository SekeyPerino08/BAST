CREATE TYPE "AdmissionStage" AS ENUM (
    'DOCUMENT_COLLECTION',
    'REVIEW',
    'ACCEPTED',
    'ENROLLMENT',
    'ENROLLED'
);

CREATE TYPE "StudentSupportAlertStatus" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'RESOLVED'
);

CREATE TYPE "StudentSupportAlertRule" AS ENUM (
    'LOW_GRADE',
    'DECLINING_GRADE',
    'ATTENDANCE'
);

CREATE TYPE "RecoveryExerciseKind" AS ENUM (
    'BACKUP_VERIFICATION',
    'RESTORE_TEST'
);

CREATE TYPE "RecoveryExerciseResult" AS ENUM (
    'PASSED',
    'FAILED'
);

CREATE TABLE "Applicant" (
    "id" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "strand" "SeniorHighStrand",
    "guardianName" TEXT,
    "guardianContact" TEXT,
    "documents" JSONB NOT NULL,
    "stage" "AdmissionStage" NOT NULL DEFAULT 'DOCUMENT_COLLECTION',
    "studentId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Applicant_gradeLevel_check" CHECK (
      ("gradeLevel" BETWEEN 7 AND 10 AND "strand" IS NULL) OR
      ("gradeLevel" IN (11, 12) AND "strand" IS NOT NULL)
    ),
    CONSTRAINT "Applicant_schoolYearId_fkey" FOREIGN KEY ("schoolYearId")
      REFERENCES "SchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Applicant_studentId_fkey" FOREIGN KEY ("studentId")
      REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "StudentSupportAlert" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "rule" "StudentSupportAlertRule" NOT NULL,
    "status" "StudentSupportAlertStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "summary" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "followUpNote" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StudentSupportAlert_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudentSupportAlert_studentId_fkey" FOREIGN KEY ("studentId")
      REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentSupportAlert_schoolYearId_fkey" FOREIGN KEY ("schoolYearId")
      REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentSupportAlert_updatedById_fkey" FOREIGN KEY ("updatedById")
      REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Applicant_studentId_key" ON "Applicant"("studentId");
CREATE INDEX "Applicant_schoolYearId_stage_idx" ON "Applicant"("schoolYearId", "stage");
CREATE INDEX "Applicant_lastName_firstName_idx" ON "Applicant"("lastName", "firstName");
CREATE UNIQUE INDEX "StudentSupportAlert_studentId_schoolYearId_rule_key"
  ON "StudentSupportAlert"("studentId", "schoolYearId", "rule");
CREATE INDEX "StudentSupportAlert_schoolYearId_status_idx"
  ON "StudentSupportAlert"("schoolYearId", "status");
CREATE INDEX "StudentSupportAlert_studentId_idx" ON "StudentSupportAlert"("studentId");

CREATE TABLE "RecoveryExercise" (
    "id" TEXT NOT NULL,
    "kind" "RecoveryExerciseKind" NOT NULL,
    "result" "RecoveryExerciseResult" NOT NULL,
    "testedAt" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryExercise_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RecoveryExercise_recordedById_fkey" FOREIGN KEY ("recordedById")
      REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "RecoveryExercise_kind_testedAt_idx" ON "RecoveryExercise"("kind", "testedAt");
CREATE INDEX "RecoveryExercise_recordedById_idx" ON "RecoveryExercise"("recordedById");
