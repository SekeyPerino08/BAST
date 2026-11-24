CREATE TABLE "LearningMaterial" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRestricted" BOOLEAN NOT NULL DEFAULT false,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT,
    "classOfferingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LearningMaterial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LearningMaterial_subjectId_idx" ON "LearningMaterial"("subjectId");
CREATE INDEX "LearningMaterial_classOfferingId_idx" ON "LearningMaterial"("classOfferingId");
CREATE INDEX "LearningMaterial_teacherId_idx" ON "LearningMaterial"("teacherId");

ALTER TABLE "LearningMaterial"
    ADD CONSTRAINT "LearningMaterial_teacherId_fkey"
        FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "LearningMaterial_subjectId_fkey"
        FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "LearningMaterial_classOfferingId_fkey"
        FOREIGN KEY ("classOfferingId") REFERENCES "ClassOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
