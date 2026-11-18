DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "Student" WHERE "userId" IS NULL) THEN
        RAISE EXCEPTION 'Student.userId contains NULL values; review and repair them before applying this migration';
    END IF;
    IF EXISTS (SELECT 1 FROM "Teacher" WHERE "userId" IS NULL) THEN
        RAISE EXCEPTION 'Teacher.userId contains NULL values; review and repair them before applying this migration';
    END IF;
END $$;

ALTER TABLE "Student" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Teacher" ALTER COLUMN "userId" SET NOT NULL;
