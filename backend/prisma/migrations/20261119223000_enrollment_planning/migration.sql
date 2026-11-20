CREATE TYPE "SeniorHighStrand" AS ENUM ('GAS', 'ABM', 'STEM', 'HUMSS', 'TVL_ICT');

ALTER TABLE "Section"
ADD COLUMN "strand" "SeniorHighStrand",
ADD COLUMN "capacity" INTEGER,
ADD CONSTRAINT "Section_capacity_check" CHECK ("capacity" IS NULL OR "capacity" > 0);

CREATE TABLE "EnrollmentPlan" (
    "id" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "registrationOpensAt" TIMESTAMPTZ(6),
    "registrationClosesAt" TIMESTAMPTZ(6),
    "firstDayOfClasses" TIMESTAMPTZ(6),
    "modality" TEXT NOT NULL DEFAULT 'HYBRID',
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "requirements" JSONB NOT NULL,
    "specialPolicies" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EnrollmentPlan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EnrollmentPlan_schoolYearId_fkey" FOREIGN KEY ("schoolYearId")
      REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "EnrollmentStrandTarget" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "strand" "SeniorHighStrand" NOT NULL,
    "expectedNew" INTEGER,
    "expectedReturning" INTEGER,
    "plannedSections" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EnrollmentStrandTarget_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EnrollmentStrandTarget_gradeLevel_check" CHECK ("gradeLevel" IN (11, 12)),
    CONSTRAINT "EnrollmentStrandTarget_counts_check" CHECK (
      ("expectedNew" IS NULL OR "expectedNew" >= 0) AND
      ("expectedReturning" IS NULL OR "expectedReturning" >= 0) AND
      ("plannedSections" IS NULL OR "plannedSections" >= 0)
    ),
    CONSTRAINT "EnrollmentStrandTarget_planId_fkey" FOREIGN KEY ("planId")
      REFERENCES "EnrollmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EnrollmentPlan_schoolYearId_key" ON "EnrollmentPlan"("schoolYearId");
CREATE UNIQUE INDEX "EnrollmentStrandTarget_planId_gradeLevel_strand_key"
  ON "EnrollmentStrandTarget"("planId", "gradeLevel", "strand");
CREATE INDEX "EnrollmentStrandTarget_planId_idx" ON "EnrollmentStrandTarget"("planId");
