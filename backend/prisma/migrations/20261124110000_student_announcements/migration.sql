CREATE TYPE "AnnouncementCategory" AS ENUM ('SCHOOL', 'CLASS', 'SUBJECT');

CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "AnnouncementCategory" NOT NULL DEFAULT 'SCHOOL',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "classOfferingId" TEXT,
    "subjectId" TEXT,
    "attachments" TEXT[],
    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Announcement_category_publishedAt_idx" ON "Announcement"("category", "publishedAt");
CREATE INDEX "Announcement_classOfferingId_idx" ON "Announcement"("classOfferingId");
CREATE INDEX "Announcement_subjectId_idx" ON "Announcement"("subjectId");

ALTER TABLE "Announcement"
    ADD CONSTRAINT "Announcement_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "Announcement_classOfferingId_fkey"
        FOREIGN KEY ("classOfferingId") REFERENCES "ClassOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "Announcement_subjectId_fkey"
        FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
