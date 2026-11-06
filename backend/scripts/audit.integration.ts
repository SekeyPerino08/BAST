import assert from "node:assert/strict";
import type { Request } from "express";
const databaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Set INTEGRATION_TEST_DATABASE_URL to an isolated, migrated test database.");
}
process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = databaseUrl;

const [{ Role }, { audit }, { prisma }] = await Promise.all([
  import("@prisma/client"),
  import("../src/audit.js"),
  import("../src/lib/prisma.js"),
]);
const request = {
  user: { id: "audit-test-actor", role: Role.ADMIN, email: "audit-test@example.test" },
  ip: "127.0.0.1",
} as Pick<Request, "user" | "ip">;

try {
  const entry = await prisma.auditEntry.create({
    data: { action: "AUDIT_TRIGGER_TEST", entityType: "Test", after: { safe: true } },
  });

  await assert.rejects(
    prisma.auditEntry.update({ where: { id: entry.id }, data: { action: "MUTATED" } }),
    /append-only/i,
  );
  await assert.rejects(
    prisma.auditEntry.delete({ where: { id: entry.id } }),
    /append-only/i,
  );

  const marker = `rollback-${Date.now()}`;
  await assert.rejects(
    prisma.$transaction(async (transaction) => {
      await audit(transaction, request, {
        action: "AUDIT_ROLLBACK_TEST",
        entityType: "Test",
        entityId: marker,
      });
      throw new Error("force transaction rollback");
    }),
    /force transaction rollback/,
  );
  assert.equal(await prisma.auditEntry.count({ where: { entityId: marker } }), 0);
  console.log("Audit database integration tests passed");
} finally {
  await prisma.$disconnect();
}
