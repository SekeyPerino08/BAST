CREATE TABLE "ClassSchedule" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "classOfferingId" TEXT,
    "schoolYearId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClassSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassSchedule_studentId_schoolYearId_idx" ON "ClassSchedule"("studentId", "schoolYearId");
CREATE INDEX "ClassSchedule_sectionId_idx" ON "ClassSchedule"("sectionId");
CREATE INDEX "ClassSchedule_classOfferingId_idx" ON "ClassSchedule"("classOfferingId");

ALTER TABLE "ClassSchedule"
    ADD CONSTRAINT "ClassSchedule_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ClassSchedule_sectionId_fkey"
        FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ClassSchedule_subjectId_fkey"
        FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ClassSchedule_teacherId_fkey"
        FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ClassSchedule_classOfferingId_fkey"
        FOREIGN KEY ("classOfferingId") REFERENCES "ClassOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
