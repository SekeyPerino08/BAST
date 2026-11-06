ALTER TABLE "User" ADD COLUMN "loginId" TEXT;

UPDATE "User" AS u
SET "loginId" = upper(s."studentNo")
FROM "Student" AS s
WHERE u."id" = s."userId"
  AND u."role" = 'STUDENT';

UPDATE "User" AS u
SET "loginId" = upper(t."employeeNo")
FROM "Teacher" AS t
WHERE u."id" = t."userId"
  AND u."role" = 'TEACHER';

UPDATE "User"
SET "loginId" = 'ADMIN-' || upper(substr(md5("id"), 1, 8))
WHERE "role" = 'ADMIN';

CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");
