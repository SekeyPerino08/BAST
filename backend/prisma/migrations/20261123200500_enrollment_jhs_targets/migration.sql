CREATE TABLE "EnrollmentGradeTarget" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "expectedNew" INTEGER,
    "expectedReturning" INTEGER,
    "plannedSections" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EnrollmentGradeTarget_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EnrollmentGradeTarget_gradeLevel_check" CHECK ("gradeLevel" IN (7, 8, 9, 10)),
    CONSTRAINT "EnrollmentGradeTarget_counts_check" CHECK (
      ("expectedNew" IS NULL OR "expectedNew" >= 0) AND
      ("expectedReturning" IS NULL OR "expectedReturning" >= 0) AND
      ("plannedSections" IS NULL OR "plannedSections" >= 0)
    ),
    CONSTRAINT "EnrollmentGradeTarget_planId_fkey" FOREIGN KEY ("planId")
      REFERENCES "EnrollmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EnrollmentGradeTarget_planId_gradeLevel_key"
  ON "EnrollmentGradeTarget"("planId", "gradeLevel");
CREATE INDEX "EnrollmentGradeTarget_planId_idx" ON "EnrollmentGradeTarget"("planId");
