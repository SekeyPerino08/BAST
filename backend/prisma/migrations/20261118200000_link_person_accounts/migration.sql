DO $$
DECLARE
    person RECORD;
    base_email TEXT;
    account_email TEXT;
    attempt INTEGER;
    account_id TEXT;
BEGIN
    FOR person IN
        SELECT "id", "studentNo", "firstName", "lastName", "status"
        FROM "Student"
        WHERE "userId" IS NULL
        ORDER BY "id"
    LOOP
        base_email := lower(person."studentNo") || '.' || person."id" || '@students.uni.edu';
        account_email := base_email;
        attempt := 0;
        WHILE EXISTS (SELECT 1 FROM "User" WHERE "email" = account_email) LOOP
            attempt := attempt + 1;
            account_email := lower(person."studentNo") || '.' || person."id" || '.' || attempt || '@students.uni.edu';
        END LOOP;

        account_id := gen_random_uuid()::TEXT;
        INSERT INTO "User" (
            "id", "email", "passwordHash", "role", "firstName", "lastName",
            "isActive", "mustChangePassword", "createdAt", "updatedAt"
        )
        VALUES (
            account_id, account_email,
            '$2b$12$neqGEC4ng0nF5EBRaVTssukQIeN1un9N7ZnAHDyi.ukLNeIKO6.Yu',
            CASE WHEN person."status" = 'GRADUATED' THEN 'ALUMNI'::"Role" ELSE 'STUDENT'::"Role" END,
            person."firstName", person."lastName",
            person."status" NOT IN ('INACTIVE', 'DROPPED', 'TRANSFERRED'), TRUE, NOW(), NOW()
        );
        UPDATE "Student" SET "userId" = account_id WHERE "id" = person."id";
    END LOOP;

    FOR person IN
        SELECT "id", "employeeNo", "firstName", "lastName", "isActive"
        FROM "Teacher"
        WHERE "userId" IS NULL
        ORDER BY "id"
    LOOP
        base_email := lower(person."employeeNo") || '.' || person."id" || '@teachers.uni.edu';
        account_email := base_email;
        attempt := 0;
        WHILE EXISTS (SELECT 1 FROM "User" WHERE "email" = account_email) LOOP
            attempt := attempt + 1;
            account_email := lower(person."employeeNo") || '.' || person."id" || '.' || attempt || '@teachers.uni.edu';
        END LOOP;

        account_id := gen_random_uuid()::TEXT;
        INSERT INTO "User" (
            "id", "email", "passwordHash", "role", "firstName", "lastName",
            "isActive", "mustChangePassword", "createdAt", "updatedAt"
        )
        VALUES (
            account_id, account_email,
            '$2b$12$neqGEC4ng0nF5EBRaVTssukQIeN1un9N7ZnAHDyi.ukLNeIKO6.Yu',
            'TEACHER'::"Role", person."firstName", person."lastName",
            person."isActive", TRUE, NOW(), NOW()
        );
        UPDATE "Teacher" SET "userId" = account_id WHERE "id" = person."id";
    END LOOP;
END $$;

UPDATE "User"
SET "passwordHash" = '$2b$12$neqGEC4ng0nF5EBRaVTssukQIeN1un9N7ZnAHDyi.ukLNeIKO6.Yu',
    "mustChangePassword" = TRUE,
    "updatedAt" = NOW();

UPDATE "User" AS account
SET "passwordHash" = '$2b$12$neqGEC4ng0nF5EBRaVTssukQIeN1un9N7ZnAHDyi.ukLNeIKO6.Yu',
    "mustChangePassword" = TRUE,
    "role" = CASE WHEN student."status" = 'GRADUATED' THEN 'ALUMNI'::"Role" ELSE 'STUDENT'::"Role" END,
    "isActive" = student."status" NOT IN ('INACTIVE', 'DROPPED', 'TRANSFERRED'),
    "updatedAt" = NOW()
FROM "Student" AS student
WHERE student."userId" = account."id";

UPDATE "User" AS account
SET "passwordHash" = '$2b$12$neqGEC4ng0nF5EBRaVTssukQIeN1un9N7ZnAHDyi.ukLNeIKO6.Yu',
    "mustChangePassword" = TRUE,
    "role" = 'TEACHER'::"Role",
    "isActive" = teacher."isActive",
    "updatedAt" = NOW()
FROM "Teacher" AS teacher
WHERE teacher."userId" = account."id";

ALTER TABLE "Student" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Teacher" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "Student" DROP CONSTRAINT "Student_userId_fkey";
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Teacher" DROP CONSTRAINT "Teacher_userId_fkey";
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
