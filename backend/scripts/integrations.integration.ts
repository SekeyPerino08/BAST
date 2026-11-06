import assert from "node:assert/strict";
import type { Request } from "express";

const databaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Set INTEGRATION_TEST_DATABASE_URL to an isolated, migrated, seeded test database.");
}
process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = databaseUrl;

const [{ prisma }, { syncFeed }, { Role }] = await Promise.all([
  import("../src/lib/prisma.js"),
  import("../src/modules/integrations/integration.service.js"),
  import("@prisma/client"),
]);

try {
  const admin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    select: { id: true, role: true, email: true },
  });
  assert.ok(admin, "The integration test database must be seeded with an admin");
  const request = {
    user: { id: admin.id, role: admin.role, email: admin.email },
    ip: "127.0.0.1",
  } as Pick<Request, "user" | "ip">;

  const externalIds = ["lms-login-001", "lms-submit-001", "lms-quiz-001"];
  const where = { source: "lms", externalId: { in: externalIds } };
  const beforePreview = await prisma.lmsEvent.count({ where });
  const auditsBeforePreview = await prisma.auditEntry.count({ where: { action: "SYNC_COMMIT" } });
  const preview = await syncFeed(
    { source: "lms" },
    { mode: "preview", batch: "current" },
    admin,
    request,
  );
  const afterPreview = await prisma.lmsEvent.count({ where });
  assert.equal(afterPreview, beforePreview, "Preview must not write LMS feed rows");
  assert.equal(await prisma.auditEntry.count({ where: { action: "SYNC_COMMIT" } }), auditsBeforePreview, "Preview must not write a commit audit row");
  assert.ok(
    preview.rejects.some((reject) => reject.reason.includes("did not match a student")),
    "Unknown student number must be rejected with a reason",
  );

  const firstCommit = await syncFeed(
    { source: "lms" },
    { mode: "commit", batch: "current" },
    admin,
    request,
  );
  const afterFirstCommit = await prisma.lmsEvent.count({ where });
  assert.equal(await prisma.auditEntry.count({ where: { action: "SYNC_COMMIT" } }), auditsBeforePreview + 1, "A commit must write an audit row");
  const secondCommit = await syncFeed(
    { source: "lms" },
    { mode: "commit", batch: "current" },
    admin,
    request,
  );
  const afterSecondCommit = await prisma.lmsEvent.count({ where });
  assert.equal(afterSecondCommit, afterFirstCommit, "Repeating a commit must not create duplicates");
  assert.equal(secondCommit.data.accepted, firstCommit.data.accepted, "Repeat commit row counts must remain stable");
  assert.equal(await prisma.auditEntry.count({ where: { action: "SYNC_COMMIT" } }), auditsBeforePreview + 2, "Every commit must be audited");
  console.log("Integration feed preview, unknown-student reject, and idempotent-commit tests passed.");
} finally {
  await prisma.$disconnect();
}
