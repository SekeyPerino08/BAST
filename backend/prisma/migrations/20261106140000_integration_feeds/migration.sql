ALTER TYPE "Role" ADD VALUE 'ALUMNI';

CREATE TYPE "LmsEventType" AS ENUM ('LOGIN', 'SUBMISSION', 'QUIZ');
CREATE TYPE "AlumniRecordKind" AS ENUM ('DONATION', 'EVENT', 'MENTORING');
CREATE TYPE "FeedImportMode" AS ENUM ('PREVIEW', 'COMMIT');

CREATE TABLE "lms_events" (
  "id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "course_id" TEXT,
  "type" "LmsEventType" NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "score" DECIMAL(5,2),
  "on_time" BOOLEAN,
  "external_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  CONSTRAINT "lms_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lms_events_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lms_events_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "lms_events_source_external_id_key" ON "lms_events"("source", "external_id");
CREATE INDEX "lms_events_student_id_occurred_at_idx" ON "lms_events"("student_id", "occurred_at");

CREATE TABLE "library_loans" (
  "id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "book_title" TEXT NOT NULL,
  "loaned_on" DATE NOT NULL,
  "due_on" DATE NOT NULL,
  "returned_on" DATE,
  "external_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  CONSTRAINT "library_loans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "library_loans_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "library_loans_source_external_id_key" ON "library_loans"("source", "external_id");
CREATE INDEX "library_loans_student_id_due_on_idx" ON "library_loans"("student_id", "due_on");

CREATE TABLE "alumni_records" (
  "id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "kind" "AlumniRecordKind" NOT NULL,
  "amount" DECIMAL(12,2),
  "occurred_on" DATE NOT NULL,
  "detail" TEXT,
  "external_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  CONSTRAINT "alumni_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "alumni_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "alumni_records_source_external_id_key" ON "alumni_records"("source", "external_id");
CREATE INDEX "alumni_records_student_id_occurred_on_idx" ON "alumni_records"("student_id", "occurred_on");

CREATE TABLE "import_runs" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "mode" "FeedImportMode" NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "received" INTEGER NOT NULL DEFAULT 0,
  "accepted" INTEGER NOT NULL DEFAULT 0,
  "rejected" INTEGER NOT NULL DEFAULT 0,
  "run_by" TEXT,
  CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "import_runs_run_by_fkey" FOREIGN KEY ("run_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "import_runs_source_started_at_idx" ON "import_runs"("source", "started_at");
CREATE INDEX "import_runs_run_by_idx" ON "import_runs"("run_by");

CREATE TABLE "import_rejects" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "row_number" INTEGER NOT NULL,
  "raw" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  CONSTRAINT "import_rejects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "import_rejects_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "import_rejects_run_id_row_number_key" ON "import_rejects"("run_id", "row_number");
CREATE INDEX "import_rejects_run_id_idx" ON "import_rejects"("run_id");
